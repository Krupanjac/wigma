import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { VideoNode } from '../engine/scene-graph/video-node';
import { Vec2 } from '../shared/math/vec2';

/**
 * VideoTool — Figma-style: opens a file picker on activation,
 * loads the selected video, extracts a poster frame from the
 * first video frame, and places a VideoNode on the canvas at
 * native resolution centered in the current viewport.
 */
export class VideoTool extends BaseTool {
  readonly type: ToolType = 'video';
  readonly label = 'Video';
  readonly icon = 'video';
  readonly shortcut = 'Shift+V';

  constructor(private engine: CanvasEngine) { super(); }

  override onActivate(): void {
    this.openFilePicker();
  }

  override onPointerDown(_event: PointerEventData): void {
    // No-op: placement happens automatically after file picker
  }

  // ── File picker ────────────────────────────────────────────

  private openFilePicker(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.multiple = true;
    input.style.display = 'none';

    input.addEventListener('change', () => {
      const files = input.files;
      if (files && files.length > 0) {
        this.processFiles(Array.from(files));
      }
      document.body.removeChild(input);
    });

    input.addEventListener('cancel', () => {
      document.body.removeChild(input);
    });

    document.body.appendChild(input);
    input.click();
  }

  private processFiles(files: File[]): void {
    const camera = this.engine.viewport.camera;
    const viewCenter = camera.screenToWorld(
      new Vec2(camera.screenWidth / 2, camera.screenHeight / 2)
    );
    let offsetX = 0;

    for (const file of files) {
      this.loadVideo(file, viewCenter.x + offsetX, viewCenter.y);
      offsetX += 20;
    }
  }

  private loadVideo(file: File, cx: number, cy: number): void {
    const blobUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    video.onloadedmetadata = () => {
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 360;

      // Seek to first frame for poster extraction
      video.currentTime = 0.1;

      video.onseeked = () => {
        // Extract poster frame from video
        const posterDataUrl = this.extractPosterFrame(video, vw, vh);

        // Read file as data URL for persistence
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;

          const node = new VideoNode(file.name.replace(/\.[^.]+$/, ''));
          node.naturalWidth = vw;
          node.naturalHeight = vh;
          node.width = vw;
          node.height = vh;
          node.src = dataUrl;
          node.posterSrc = posterDataUrl;
          node.duration = video.duration || 0;

          // Center on viewport
          node.x = cx - node.width / 2;
          node.y = cy - node.height / 2;

          this.engine.sceneGraph.addNode(node, this.engine.activePage ?? undefined);
          this.engine.selection.select(node);
          this.engine.sceneGraph.notifyNodeChanged(node);

          // Clean up
          URL.revokeObjectURL(blobUrl);
          video.remove();
        };
        reader.readAsDataURL(file);
      };
    };

    video.onerror = () => {
      console.error('[VideoTool] Failed to load video:', file.name);
      URL.revokeObjectURL(blobUrl);
      video.remove();
    };

    video.src = blobUrl;
  }

  private extractPosterFrame(video: HTMLVideoElement, w: number, h: number): string {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, w, h);
    }
    return canvas.toDataURL('image/jpeg', 0.85);
  }
}
