import { inject, Injectable } from '@angular/core';
import { CanvasEngine } from '../../engine/canvas-engine';
import { ExportRenderer, ExportOptions, PageContentBounds } from '../../engine/rendering/export-renderer';
import { LoaderService } from './loader.service';
import { extractAssets } from '../../shared/utils/asset-dedup';

/**
 * ExportService — exports the active page content to PNG, WebP, or JSON.
 *
 * Uses ExportRenderer for high-quality off-screen rendering that captures
 * only the page content region (not the infinite canvas background or overlays).
 *
 * When the scene contains image or video nodes (with large embedded
 * base64 data-URLs), the JSON export is gzip-compressed and saved as
 * `.json.gz` to reduce file size.
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
    this.downloadBlobUrl(dataUrl, name);
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
    this.downloadBlobUrl(dataUrl, name);
  }

  // ── JSON export ────────────────────────────────────────────

  /**
   * Export the full scene graph as a plain JSON string.
   * Media blobs are deduplicated into an `assets` table.
   */
  exportJSON(): string {
    this.assertReady();
    const nodes = this.engine!.sceneGraph.getAllNodes()
      .filter(n => n !== this.engine!.sceneGraph.root)
      .map(n => n.toJSON());

    const assets = extractAssets(nodes as any[]);
    const hasAssets = Object.keys(assets).length > 0;

    return JSON.stringify(
      hasAssets ? { assets, nodes } : { nodes },
      null,
      2
    );
  }

  /**
   * Download the scene graph as JSON.
   * When media nodes are present the output is gzip-compressed (.json.gz).
   */
  async downloadJSON(filename: string = 'wigma-export'): Promise<void> {
    this.assertReady();
    const json = this.exportJSON();
    await this.downloadJsonString(json, filename);
  }

  /**
   * Download a full project document (DocumentModel) as JSON.
   * Gzip-compresses when the data contains embedded media data-URLs.
   *
   * @param json  Pre-serialized JSON string from ProjectService.toJSON()
   * @param filename  Base filename (without extension)
   */
  async downloadProjectJSON(json: string, filename: string = 'wigma-project'): Promise<void> {
    await this.downloadJsonString(json, filename);
  }

  // ── Private helpers ────────────────────────────────────────

  /**
   * Shared download logic: gzip-compresses to `.json.gz` when the scene
   * has media nodes, otherwise saves plain `.json`.
   */
  private async downloadJsonString(json: string, filename: string): Promise<void> {
    const compress = this.hasMediaNodes();
    const baseName = this.stripExtension(filename);

    if (compress) {
      const blob = await this.loader.wrap('Compressing JSON…', () =>
        this.compressGzip(json)
      );
      const url = URL.createObjectURL(blob);
      this.downloadBlobUrl(url, baseName + '.json.gz');
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      this.downloadBlobUrl(url, baseName + '.json');
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Returns true when any node in the scene graph is an image or video.
   */
  private hasMediaNodes(): boolean {
    const nodes = this.engine!.sceneGraph.getAllNodes();
    return nodes.some(n => n.type === 'image' || n.type === 'video');
  }

  /**
   * Gzip-compress a string using the Compression Streams API.
   * Uses a pull-based ReadableStream that feeds 1 MB text chunks on demand,
   * piped through CompressionStream. This avoids both OOM (no single huge
   * allocation) and backpressure deadlocks (pull-based flow control).
   */
  private compressGzip(data: string): Promise<Blob> {
    const encoder = new TextEncoder();
    const CHUNK = 1 << 20; // 1 MB of characters per chunk
    let offset = 0;

    const source = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= data.length) {
          controller.close();
          return;
        }
        const slice = data.slice(offset, offset + CHUNK);
        offset += CHUNK;
        controller.enqueue(encoder.encode(slice));
      },
    });

    const compressed = source.pipeThrough(
      new CompressionStream('gzip') as any
    );
    return new Response(compressed).blob();
  }

  private assertReady(): void {
    if (!this.engine || !this.exportRenderer) {
      throw new Error('ExportService not initialized — call init(engine) first');
    }
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9_\-. ]/g, '_').trim() || 'export';
  }

  private stripExtension(name: string): string {
    return name.replace(/\.(json|json\.gz|wigma)$/i, '');
  }

  private downloadBlobUrl(url: string, filename: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
