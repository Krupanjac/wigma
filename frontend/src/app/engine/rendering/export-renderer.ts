import { Application, Container, Rectangle } from 'pixi.js';
import { SceneGraphManager } from '../scene-graph/scene-graph-manager';
import { BaseNode } from '../scene-graph/base-node';
import { RenderManager } from './render-manager';
import { MutableBounds } from '@shared/math/bounds';

/** Safe max texture dimension — most GPUs support at least 4096. */
const FALLBACK_MAX_TEXTURE = 4096;

/**
 * Export options for rendering a page region to an image.
 */
export interface ExportOptions {
  /** Resolution multiplier (1 = 72dpi, 2 = 144dpi, 4 = 288dpi). Default: 2 */
  scale?: number;
  /** Output format. Default: 'png' */
  format?: 'png' | 'webp' | 'jpeg';
  /** Quality for lossy formats (0–1). Default: 0.92 */
  quality?: number;
  /** Padding around content bounds in world pixels. Default: 0 */
  padding?: number;
  /** Background color (hex number). Default: transparent (null) */
  background?: number | null;
  /** Whether to include background. Default: false (transparent) */
  includeBackground?: boolean;
}

/**
 * Computed page content bounds — metadata derived from the scene graph.
 * This is NOT stored on the page node; it's computed on-demand.
 */
export interface PageContentBounds {
  /** World-space bounding box of all page content. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Number of child nodes contributing to the bounds. */
  nodeCount: number;
  /** Whether the page has any visible content. */
  isEmpty: boolean;
}

/**
 * ExportRenderer — renders a specific region of the canvas to an off-screen
 * image using the PixiJS extract system.
 *
 * Workflow:
 * 1. Compute content bounds of the target page (union of all descendants' worldBounds)
 * 2. Temporarily reconfigure the world container to frame the content region
 * 3. Use `app.renderer.extract` to capture the framed region at the desired resolution
 * 4. Restore the original camera/viewport state
 *
 * This class is stateless and side-effect-free (except during the brief render capture).
 */
export class ExportRenderer {

  constructor(
    private readonly sceneGraph: SceneGraphManager,
    private readonly renderManager: RenderManager
  ) {}

  // ── Page content bounds ────────────────────────────────────

  /**
   * Compute the content bounds of a page by unioning the worldBounds
   * of all its visible descendants.
   *
   * This serves as the "virtual transform box" of the page content,
   * providing the export region without treating the page as a selectable object.
   */
  computePageContentBounds(page: BaseNode): PageContentBounds {
    const descendants = this.collectVisibleDescendants(page);

    if (descendants.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0, nodeCount: 0, isEmpty: true };
    }

    const mb = new MutableBounds();
    for (const node of descendants) {
      const wb = node.worldBounds;
      mb.addPoint(wb.minX, wb.minY);
      mb.addPoint(wb.maxX, wb.maxY);
    }

    const bounds = mb.toImmutable();
    return {
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.width,
      height: bounds.height,
      nodeCount: descendants.length,
      isEmpty: false,
    };
  }

  // ── Export rendering ───────────────────────────────────────

  /**
   * Render the active page content to a PNG (or other format) data URL.
   *
   * Strategy:
   * 1. Compute content bounds of the page
   * 2. Temporarily position the worldContainer so the content region
   *    maps to (0, 0) on the PixiJS stage
   * 3. Use `renderer.extract.base64()` with a frame rectangle matching
   *    the content dimensions at the requested scale
   * 4. Restore the world container's original transform
   */
  async renderPage(page: BaseNode, options: ExportOptions = {}): Promise<string> {
    const {
      scale = 2,
      format = 'png',
      quality = 0.92,
      padding = 0,
      background = null,
      includeBackground = false,
    } = options;

    const app = this.renderManager.getApp();
    if (!app) throw new Error('PixiJS application not available');

    const worldContainer = this.getWorldContainer();
    if (!worldContainer) throw new Error('World container not available');

    // 1. Compute content bounds
    const contentBounds = this.computePageContentBounds(page);
    if (contentBounds.isEmpty) {
      throw new Error('Page has no visible content to export');
    }

    // Apply padding
    const exportX = contentBounds.x - padding;
    const exportY = contentBounds.y - padding;
    const exportW = contentBounds.width + padding * 2;
    const exportH = contentBounds.height + padding * 2;

    // Clamp scale to stay within WebGL texture limits
    const safeScale = this.clampScale(app, exportW, exportH, scale);

    // 2. Save current world container state
    const savedX = worldContainer.position.x;
    const savedY = worldContainer.position.y;
    const savedScaleX = worldContainer.scale.x;
    const savedScaleY = worldContainer.scale.y;

    // 3. Temporarily reposition: place content at (0, 0) with scale=1
    worldContainer.position.set(-exportX, -exportY);
    worldContainer.scale.set(1, 1);

    // 4. Hide overlays during export
    this.setOverlaysVisible(false);

    // 5. Force a render to update the display
    app.renderer.render(app.stage);

    // 6. Extract the region
    const pixiFormat = format === 'jpeg' ? 'jpg' : format; // PixiJS uses 'jpg' not 'jpeg'

    try {
      const base64 = await app.renderer.extract.base64({
        target: app.stage,
        frame: new Rectangle(0, 0, exportW, exportH),
        resolution: safeScale,
        format: pixiFormat,
        quality,
        clearColor: includeBackground && background != null
          ? background
          : 0x00000000, // transparent
        antialias: true,
      });

      return base64;
    } finally {
      // 7. Restore original state
      worldContainer.position.set(savedX, savedY);
      worldContainer.scale.set(savedScaleX, savedScaleY);
      this.setOverlaysVisible(true);

      // Re-render to restore the view
      app.renderer.render(app.stage);
    }
  }

  /**
   * Render and return an HTMLCanvasElement for further processing.
   */
  async renderPageToCanvas(page: BaseNode, options: ExportOptions = {}): Promise<HTMLCanvasElement> {
    const {
      scale = 2,
      padding = 0,
      background = null,
      includeBackground = false,
    } = options;

    const app = this.renderManager.getApp();
    if (!app) throw new Error('PixiJS application not available');

    const worldContainer = this.getWorldContainer();
    if (!worldContainer) throw new Error('World container not available');

    const contentBounds = this.computePageContentBounds(page);
    if (contentBounds.isEmpty) {
      throw new Error('Page has no visible content to export');
    }

    const exportX = contentBounds.x - padding;
    const exportY = contentBounds.y - padding;
    const exportW = contentBounds.width + padding * 2;
    const exportH = contentBounds.height + padding * 2;

    const safeScale = this.clampScale(app, exportW, exportH, scale);

    const savedX = worldContainer.position.x;
    const savedY = worldContainer.position.y;
    const savedScaleX = worldContainer.scale.x;
    const savedScaleY = worldContainer.scale.y;

    worldContainer.position.set(-exportX, -exportY);
    worldContainer.scale.set(1, 1);
    this.setOverlaysVisible(false);

    app.renderer.render(app.stage);

    try {
      const canvas = app.renderer.extract.canvas({
        target: app.stage,
        frame: new Rectangle(0, 0, exportW, exportH),
        resolution: safeScale,
        clearColor: includeBackground && background != null
          ? background
          : 0x00000000,
        antialias: true,
      }) as HTMLCanvasElement;

      return canvas;
    } finally {
      worldContainer.position.set(savedX, savedY);
      worldContainer.scale.set(savedScaleX, savedScaleY);
      this.setOverlaysVisible(true);
      app.renderer.render(app.stage);
    }
  }

  // ── Private helpers ────────────────────────────────────────

  /**
   * Collect all visible leaf descendants of a page node (skip groups
   * that are just containers, but include their visible children).
   */
  private collectVisibleDescendants(page: BaseNode): BaseNode[] {
    const result: BaseNode[] = [];
    const walk = (node: BaseNode) => {
      for (const child of node.children) {
        if (!child.visible) continue;
        // Include leaf nodes and groups (their bounds encompass children)
        if (child.type !== 'group') {
          result.push(child);
        }
        // Always recurse into groups to get actual shapes
        if (child.children.length > 0) {
          walk(child);
        }
      }
    };
    walk(page);
    return result;
  }

  private getWorldContainer(): Container | null {
    // Access via the app stage — worldContainer is always the first child
    const app = this.renderManager.getApp();
    if (!app?.stage?.children?.length) return null;
    return app.stage.children[0] as Container;
  }

  private setOverlaysVisible(visible: boolean): void {
    const app = this.renderManager.getApp();
    if (!app?.stage) return;

    // The worldContainer is stage.children[0]. Everything after it is an overlay.
    for (let i = 1; i < app.stage.children.length; i++) {
      app.stage.children[i].visible = visible;
    }
  }

  // ── Size-safety helpers ────────────────────────────────────

  /**
   * Query the GPU's MAX_TEXTURE_SIZE and reduce scale so the output
   * pixel dimensions never exceed it.
   *
   * For example, a 10 000 × 8 000 px content region at scale 2 would
   * need a 20 000 × 16 000 texture.  If MAX_TEXTURE_SIZE is 16 384,
   * the scale is reduced to 16 384 / 10 000 ≈ 1.638 so the longest
   * axis fits.
   */
  private clampScale(app: Application, w: number, h: number, requestedScale: number): number {
    const maxTex = this.getMaxTextureSize(app);
    const maxPixelW = w * requestedScale;
    const maxPixelH = h * requestedScale;
    const maxPixel = Math.max(maxPixelW, maxPixelH);

    if (maxPixel <= maxTex) return requestedScale;

    // Scale down proportionally so the largest axis fits
    const clamped = (maxTex / Math.max(w, h)) * 0.95; // 5 % safety margin
    console.warn(
      `[ExportRenderer] Content ${w}×${h} at scale ${requestedScale} would produce ` +
      `${Math.round(maxPixelW)}×${Math.round(maxPixelH)} px — clamping scale to ` +
      `${clamped.toFixed(3)} (MAX_TEXTURE_SIZE=${maxTex})`,
    );
    return Math.max(clamped, 0.01); // never go to zero
  }

  /** Read MAX_TEXTURE_SIZE from the WebGL context, with fallback. */
  private getMaxTextureSize(app: Application): number {
    try {
      const gl: WebGL2RenderingContext | WebGLRenderingContext | null =
        (app.renderer as any).gl ?? (app.renderer as any).context?.gl ?? null;
      if (gl) {
        return gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      }
    } catch { /* ignore */ }
    return FALLBACK_MAX_TEXTURE;
  }
}
