import { BaseTool, ToolType } from './base-tool';
import { PointerEventData } from '../engine/interaction/interaction-manager';
import { CanvasEngine } from '../engine/canvas-engine';
import { ImageNode } from '../engine/scene-graph/image-node';
import { Vec2 } from '../shared/math/vec2';

/**
 * ImageTool — Figma-style: opens a file picker on activation,
 * loads the selected image(s), and places them on the canvas at
 * native size centered in the current viewport.
 */
export class ImageTool extends BaseTool {
  readonly type: ToolType = 'image';
  readonly label = 'Image';
  readonly icon = 'image';
  readonly shortcut = 'I';

  private pendingPlacement: ImageNode | null = null;

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
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';

    input.addEventListener('change', () => {
      const files = input.files;
      if (files && files.length > 0) {
        this.processFiles(Array.from(files));
      }
      document.body.removeChild(input);
    });

    // Cancel → just clean up (auto-return handled by tool manager)
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
      this.loadImage(file, viewCenter.x + offsetX, viewCenter.y);
      offsetX += 20;
    }
  }

  private loadImage(file: File, cx: number, cy: number): void {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const node = new ImageNode(file.name.replace(/\.[^.]+$/, ''));
        node.naturalWidth = img.naturalWidth;
        node.naturalHeight = img.naturalHeight;
        node.width = img.naturalWidth;
        node.height = img.naturalHeight;
        node.src = dataUrl;

        // Center on viewport
        node.x = cx - node.width / 2;
        node.y = cy - node.height / 2;

        this.engine.sceneGraph.addNode(node, this.engine.activePage ?? undefined);
        this.engine.selection.select(node);
        this.engine.sceneGraph.notifyNodeChanged(node);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }
}
