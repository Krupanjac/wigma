/**
 * Real-time collaboration protocol — operation-based sync.
 *
 * Design rationale (Figma-style, not Yjs):
 * ──────────────────────────────────────────
 * Instead of a heavyweight CRDT library, we use a thin operation-based
 * protocol that maps 1:1 to the existing scene graph commands. The C++
 * server is a pure relay — all conflict resolution is last-writer-wins
 * at the property level, which works well for design tools.
 *
 * Wire format:
 *   Binary frame: [0x02][UTF-8 JSON operation payload]
 *   Awareness:    [0x03][UTF-8 JSON awareness payload]
 *
 * Encoding/decoding helpers at the bottom of this file.
 */

import type { SceneNodeModel } from '@wigma/shared';

// ── Scene Operations ─────────────────────────────────────────────────────────

/**
 * Atomic scene graph operations. Short field names save bytes on the wire.
 *   o  = operation type
 *   id = node ID
 *   p  = parent ID or property map
 *   n  = serialized node model
 *   i  = child index
 */
export type SceneOp =
  | { o: 'create'; n: SceneNodeModel; p: string; i?: number }
  | { o: 'delete'; id: string }
  | { o: 'modify'; id: string; props: Record<string, unknown> }
  | { o: 'move';   ids: string[]; dx: number; dy: number }
  | { o: 'resize'; id: string; x: number; y: number; w: number; h: number; sx: number; sy: number }
  | { o: 'reorder'; id: string; np: string; i: number }
  | { o: 'batch';  ops: SceneOp[] }
  | { o: 'sync-request' }
  | { o: 'full-sync'; nodes: SceneNodeModel[] };

// ── Awareness State ──────────────────────────────────────────────────────────

/**
 * Lightweight presence/cursor broadcast. Each peer sends this at ~12 Hz.
 * Compact field names to minimise payload size.
 */
export interface AwarenessState {
  /** User ID */
  u: string;
  /** Cursor position in world coordinates, null = not hovering */
  c: [number, number] | null;
  /** Selected node IDs */
  s: string[];
  /** Display name */
  n: string;
  /** Cursor hex colour */
  cl: string;
}

// ── Wire encoding/decoding ───────────────────────────────────────────────────

const MSG_SCENE_OP  = 0x02;
const MSG_AWARENESS = 0x03;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Encode a scene operation to a binary frame ready for WebSocket.send(). */
export function encodeSceneOp(op: SceneOp): Uint8Array {
  const json = JSON.stringify(op);
  const payload = encoder.encode(json);
  const frame = new Uint8Array(1 + payload.length);
  frame[0] = MSG_SCENE_OP;
  frame.set(payload, 1);
  return frame;
}

/** Decode a scene operation from a binary frame (strip type byte). */
export function decodeSceneOp(data: Uint8Array): SceneOp | null {
  try {
    const json = decoder.decode(data);
    return JSON.parse(json) as SceneOp;
  } catch {
    return null;
  }
}

/** Encode an awareness update to a binary frame. */
export function encodeAwareness(state: AwarenessState): Uint8Array {
  const json = JSON.stringify(state);
  const payload = encoder.encode(json);
  const frame = new Uint8Array(1 + payload.length);
  frame[0] = MSG_AWARENESS;
  frame.set(payload, 1);
  return frame;
}

/** Decode an awareness update from a binary frame (strip type byte). */
export function decodeAwareness(data: Uint8Array): AwarenessState | null {
  try {
    const json = decoder.decode(data);
    return JSON.parse(json) as AwarenessState;
  } catch {
    return null;
  }
}
