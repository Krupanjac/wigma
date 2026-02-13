import {
  ChangeDetectionStrategy,
  Component,
  inject,
  computed,
} from '@angular/core';
import { CollabProvider } from '../../core/services/collab-provider.service';
import type { AwarenessState } from '../../shared/collab-protocol';

/**
 * Remote cursor overlay — renders colored cursor pointers + labels
 * for each connected collaborator.
 *
 * This is an HTML overlay positioned on top of the canvas via absolute
 * positioning. Each cursor is translated from world coordinates to screen
 * coordinates using the viewport camera.
 */
@Component({
  selector: 'app-cursor-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 30;
    }
    .remote-cursor {
      position: absolute;
      left: 0;
      top: 0;
      will-change: transform;
      transition: transform 80ms linear;
    }
    .cursor-label {
      position: absolute;
      left: 12px;
      top: 14px;
      white-space: nowrap;
      padding: 1px 6px 2px;
      font-size: 10px;
      font-weight: 600;
      border-radius: 3px;
      color: white;
      pointer-events: none;
      user-select: none;
    }
  `],
  template: `
    @for (cursor of cursors(); track cursor.u) {
      <div
        class="remote-cursor"
        [style.transform]="'translate(' + cursor.screenX + 'px,' + cursor.screenY + 'px)'"
      >
        <!-- Cursor arrow SVG -->
        <svg
          width="16" height="22" viewBox="0 0 16 22" fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 1L6.5 20L9 11L15 8.5L1 1Z"
            [attr.fill]="cursor.cl"
            stroke="white"
            stroke-width="1.2"
            stroke-linejoin="round"
          />
        </svg>
        <!-- Name label -->
        <div
          class="cursor-label"
          [style.background-color]="cursor.cl"
        >
          {{ cursor.n }}
        </div>
      </div>
    }
  `,
})
export class CursorOverlayComponent {
  private readonly collabProvider = inject(CollabProvider);

  /**
   * Computed list of remote cursors with screen-space coordinates.
   * The parent component (CanvasComponent) must provide camera info
   * via the CollabProvider's engine reference.
   */
  readonly cursors = computed(() => {
    const peers = this.collabProvider.remotePeers();
    const engine = (this.collabProvider as any).engine;
    if (!engine) return [];

    const cam = engine.viewport.camera;
    const result: Array<AwarenessState & { screenX: number; screenY: number }> = [];

    for (const peer of peers.values()) {
      if (!peer.c) continue; // No cursor position — peer is not hovering canvas

      // World → screen: screen = (world - camera) * zoom
      const screenX = (peer.c[0] - cam.x) * cam.zoom;
      const screenY = (peer.c[1] - cam.y) * cam.zoom;

      result.push({ ...peer, screenX, screenY });
    }

    return result;
  });
}
