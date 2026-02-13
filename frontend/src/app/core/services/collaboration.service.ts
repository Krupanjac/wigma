import { Injectable, inject, OnDestroy, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import type { WsServerMessage } from '@wigma/shared';

/**
 * WebSocket collaboration service — connects to the C++ relay server.
 *
 * Manages the WebSocket lifecycle for real-time Yjs CRDT synchronization:
 *   1. Connects to the WS server
 *   2. Authenticates with JWT via "join" message
 *   3. Relays Yjs updates and awareness data bidirectionally
 *   4. Handles reconnection with exponential backoff
 *
 * This service is the transport layer only. CRDT logic lives in Yjs
 * (Doc, awareness), which is managed by the Yjs provider (Phase 2).
 *
 * Connection states: disconnected → connecting → authenticating → connected
 */

export type ConnectionState = 'disconnected' | 'connecting' | 'authenticating' | 'connected';

@Injectable({ providedIn: 'root' })
export class CollaborationService implements OnDestroy {
  private readonly auth = inject(AuthService);

  /** Current connection state. */
  readonly state = signal<ConnectionState>('disconnected');

  /** Connected peer user IDs. */
  readonly peers = signal<string[]>([]);

  /** Error message from last connection failure. */
  readonly error = signal<string | null>(null);

  private ws: WebSocket | null = null;
  private projectId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  // ── Event callbacks (set by Yjs provider) ─────────────────────────────────

  /** Called when a Yjs sync/update binary is received from server. */
  onYjsMessage: ((type: number, data: Uint8Array) => void) | null = null;

  /** Called when awareness data is received from server. */
  onAwarenessMessage: ((data: Uint8Array) => void) | null = null;

  /** Called when a peer joins. */
  onPeerJoined: ((userId: string) => void) | null = null;

  /** Called when a peer leaves. */
  onPeerLeft: ((userId: string) => void) | null = null;

  /** Called when connection is established and initial sync is done. */
  onConnected: (() => void) | null = null;

  ngOnDestroy(): void {
    this.disposed = true;
    this.disconnect();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Connect to a project's collaboration room. */
  async connect(projectId: string): Promise<void> {
    if (this.projectId === projectId && this.state() === 'connected') return;

    this.disconnect();
    this.projectId = projectId;
    this.reconnectAttempt = 0;
    this.disposed = false;

    await this.doConnect();
  }

  /** Disconnect from the current room. */
  disconnect(): void {
    this.clearTimers();
    this.projectId = null;

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }

    this.state.set('disconnected');
    this.peers.set([]);
    this.error.set(null);
  }

  /** Send a Yjs update to the server. */
  sendYjsUpdate(data: Uint8Array): void {
    if (!this.ws || this.state() !== 'connected') return;
    const frame = new Uint8Array(1 + data.length);
    frame[0] = 0x02; // MessageType::YjsUpdate
    frame.set(data, 1);
    this.ws.send(frame);
  }

  /** Send awareness data to the server. */
  sendAwareness(data: Uint8Array): void {
    if (!this.ws || this.state() !== 'connected') return;
    const frame = new Uint8Array(1 + data.length);
    frame[0] = 0x03; // MessageType::Awareness
    frame.set(data, 1);
    this.ws.send(frame);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async doConnect(): Promise<void> {
    if (this.disposed || !this.projectId) return;

    this.state.set('connecting');
    this.error.set(null);

    const token = await this.auth.getAccessToken();
    if (!token) {
      this.error.set('Not authenticated');
      this.state.set('disconnected');
      return;
    }

    try {
      this.ws = new WebSocket(environment.wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.state.set('authenticating');
        // Send join message
        this.ws!.send(JSON.stringify({
          type: 'join',
          projectId: this.projectId,
          token,
        }));
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          this.handleTextMessage(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          this.handleBinaryMessage(new Uint8Array(event.data));
        }
      };

      this.ws.onerror = () => {
        this.error.set('Connection error');
      };

      this.ws.onclose = () => {
        this.state.set('disconnected');
        this.clearTimers();
        this.scheduleReconnect();
      };
    } catch (err) {
      this.error.set('Failed to connect');
      this.state.set('disconnected');
      this.scheduleReconnect();
    }
  }

  private handleTextMessage(text: string): void {
    try {
      const msg = JSON.parse(text) as WsServerMessage;

      switch (msg.type) {
        case 'joined':
          this.state.set('connected');
          this.peers.set(msg.peers);
          this.reconnectAttempt = 0;
          this.startPing();
          this.onConnected?.();
          break;

        case 'peer-joined':
          this.peers.update(p => [...p, msg.userId]);
          this.onPeerJoined?.(msg.userId);
          break;

        case 'peer-left':
          this.peers.update(p => p.filter(id => id !== msg.userId));
          this.onPeerLeft?.(msg.userId);
          break;

        case 'error':
          this.error.set(`${msg.code}: ${msg.message}`);
          break;

        case 'pong':
          // Heartbeat acknowledged
          break;
      }
    } catch {
      // Ignore malformed JSON
    }
  }

  private handleBinaryMessage(data: Uint8Array): void {
    if (data.length < 1) return;

    const type = data[0];
    const payload = data.subarray(1);

    switch (type) {
      case 0x01: // YjsSync
      case 0x02: // YjsUpdate
        this.onYjsMessage?.(type, payload);
        break;

      case 0x03: // Awareness
        this.onAwarenessMessage?.(payload);
        break;
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed || !this.projectId) return;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), 30000);
    this.reconnectAttempt++;

    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, delay);
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
