import { inject, Injectable } from '@angular/core';
import { CanvasEngine } from '../../engine/canvas-engine';
import { ExportRenderer, ExportOptions, PageContentBounds } from '../../engine/rendering/export-renderer';
import { LoaderService } from './loader.service';

/**
 * ExportService — exports the active page content to PNG, WebP, or JSON.
 *
 * Uses ExportRenderer for high-quality off-screen rendering that captures
 * only the page content region (not the infinite canvas background or overlays).
 */
@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private readonly loader = inject(LoaderService);
  private engine: CanvasEngine | null = null;
  private exportRenderer: ExportRenderer | null = null;

  init(engine: CanvasEngine): void {
    this.engine = engine;
    this.exportRenderer = new ExportRenderer(engine.sceneGraph, engine.renderManager);
  }

  // ── Page content bounds ────────────────────────────────────

  /**
   * Get the content bounds of the active page.
   * This is the "virtual transform box" of all elements on the page.
   */
  getActivePageContentBounds(): PageContentBounds {
    this.assertReady();
    const page = this.engine!.activePage;
    if (!page) throw new Error('No active page');
    return this.exportRenderer!.computePageContentBounds(page);
  }

  // ── PNG export ─────────────────────────────────────────────

  /**
   * Export the active page content as a high-quality PNG data URL.
   *
   * @param options Export options (scale, padding, background, format, quality)
   * @returns Base64-encoded data URL of the rendered image
   */
  async exportPNG(options: ExportOptions = {}): Promise<string> {
    this.assertReady();
    const page = this.engine!.activePage;
    if (!page) throw new Error('No active page');

    return this.loader.wrap('Exporting PNG…', () =>
      this.exportRenderer!.renderPage(page, {
        format: 'png',
        scale: 2,
        ...options,
      })
    );
  }

  /**
   * Trigger a PNG download of the active page content.
   */
  async downloadPNG(filename?: string, options: ExportOptions = {}): Promise<void> {
    const pageName = this.engine?.activePage?.name ?? 'page';
    const name = filename ?? `${this.sanitizeFilename(pageName)}.png`;

    const dataUrl = await this.exportPNG(options);
    this.downloadDataUrl(dataUrl, name);
  }

  // ── WebP export ────────────────────────────────────────────

  async exportWebP(options: ExportOptions = {}): Promise<string> {
    this.assertReady();
    const page = this.engine!.activePage;
    if (!page) throw new Error('No active page');

    return this.loader.wrap('Exporting WebP…', () =>
      this.exportRenderer!.renderPage(page, {
        format: 'webp',
        quality: 0.92,
        scale: 2,
        ...options,
      })
    );
  }

  async downloadWebP(filename?: string, options: ExportOptions = {}): Promise<void> {
    const pageName = this.engine?.activePage?.name ?? 'page';
    const name = filename ?? `${this.sanitizeFilename(pageName)}.webp`;

    const dataUrl = await this.exportWebP(options);
    this.downloadDataUrl(dataUrl, name);
  }

  // ── JSON export ────────────────────────────────────────────

  /**
   * Export the full scene graph as JSON (uses ProjectService serialization).
   */
  exportJSON(): string {
    this.assertReady();
    const nodes = this.engine!.sceneGraph.getAllNodes();
    return JSON.stringify(
      nodes
        .filter(n => n !== this.engine!.sceneGraph.root)
        .map(n => n.toJSON()),
      null,
      2
    );
  }

  downloadJSON(filename: string = 'wigma-export.json'): void {
    const json = this.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    this.downloadDataUrl(url, filename);
    URL.revokeObjectURL(url);
  }

  // ── Private helpers ────────────────────────────────────────

  private assertReady(): void {
    if (!this.engine || !this.exportRenderer) {
      throw new Error('ExportService not initialized — call init(engine) first');
    }
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9_\-. ]/g, '_').trim() || 'export';
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
