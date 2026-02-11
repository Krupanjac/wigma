import { Injectable } from '@angular/core';
import { CanvasEngine } from '../../engine/canvas-engine';

/**
 * ExportService — exports the canvas to PNG, SVG, or JSON.
 */
@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private engine: CanvasEngine | null = null;

  init(engine: CanvasEngine): void {
    this.engine = engine;
  }

  /** Export the full canvas as a PNG data URL. */
  async exportPNG(scale: number = 2): Promise<string> {
    if (!this.engine) throw new Error('Engine not initialized');

    const app = this.engine.renderManager.getApp() as { canvas?: HTMLCanvasElement } | null;
    if (!app?.canvas) throw new Error('PixiJS app not available');

    return app.canvas.toDataURL('image/png');
  }

  /** Trigger a PNG download in the browser. */
  async downloadPNG(filename: string = 'wigma-export.png'): Promise<void> {
    const dataUrl = await this.exportPNG();
    this.downloadDataUrl(dataUrl, filename);
  }

  /** Export the scene graph as JSON. */
  exportJSON(): string {
    if (!this.engine) throw new Error('Engine not initialized');
    const nodes = this.engine.sceneGraph.getAllNodes();
    return JSON.stringify(
      nodes.map(n => ({
        id: n.id,
        type: n.type,
        name: n.name,
        x: n.x,
        y: n.y,
        width: n.width,
        height: n.height,
        rotation: n.rotation,
      })),
      null,
      2
    );
  }

  /** Trigger a JSON download. */
  downloadJSON(filename: string = 'wigma-export.json'): void {
    const json = this.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    this.downloadDataUrl(url, filename);
    URL.revokeObjectURL(url);
  }

  private downloadDataUrl(url: string, filename: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
