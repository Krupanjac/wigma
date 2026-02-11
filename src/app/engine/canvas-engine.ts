import { SceneGraphManager } from './scene-graph/scene-graph-manager';
import { SpatialIndex } from './spatial/spatial-index';
import { ViewportManager } from './viewport/viewport-manager';
import { SelectionManager } from './selection/selection-manager';
import { RenderManager } from './rendering/render-manager';
import { InteractionManager } from './interaction/interaction-manager';
import { HitTester } from './interaction/hit-tester';
import { SnapEngine } from './interaction/snap-engine';
import { GroupNode } from './scene-graph/group-node';

/**
 * CanvasEngine — the main entry point for the pure OOP engine layer.
 *
 * Zero Angular dependencies. Initialized from CanvasComponent
 * inside NgZone.runOutsideAngular() for maximum performance.
 *
 * Owns all engine subsystems and wires them together.
 */
export class CanvasEngine {
  readonly sceneGraph: SceneGraphManager;
  readonly spatialIndex: SpatialIndex;
  readonly viewport: ViewportManager;
  readonly selection: SelectionManager;
  readonly renderManager: RenderManager;
  readonly interaction: InteractionManager;
  readonly hitTester: HitTester;
  readonly snapEngine: SnapEngine;

  private running: boolean = false;
  private animationFrameId: number = 0;

  constructor() {
    this.sceneGraph = new SceneGraphManager();
    this.spatialIndex = new SpatialIndex();
    this.viewport = new ViewportManager();
    this.selection = new SelectionManager();
    this.snapEngine = new SnapEngine();
    this.interaction = new InteractionManager(this.viewport);
    this.hitTester = new HitTester(this.sceneGraph, this.spatialIndex);
    this.renderManager = new RenderManager(
      this.sceneGraph, this.spatialIndex, this.viewport, this.selection
    );

    // Add default Layer 0
    const layer0 = new GroupNode('Layer 0');
    layer0.width = 0;
    layer0.height = 0;
    this.sceneGraph.addNode(layer0);

    // Wire scene events to spatial index
    this.sceneGraph.on(event => {
      switch (event.type) {
        case 'node-added':
          if (event.node !== this.sceneGraph.root) {
            this.spatialIndex.insert(event.node.id, event.node.worldBounds);
          }
          break;
        case 'node-removed':
          this.spatialIndex.remove(event.node.id);
          break;
        case 'node-changed':
          if (event.node.dirty.bounds) {
            this.spatialIndex.update(event.node.id, event.node.worldBounds);
          }
          break;
      }
    });
  }

  /**
   * Initialize the engine and attach to a container element.
   * Should be called inside NgZone.runOutsideAngular().
   */
  async init(container: HTMLElement): Promise<void> {
    await this.renderManager.init(container);

    this.interaction.attach(container);
    this.viewport.resize(container.clientWidth, container.clientHeight);

    // Setup wheel → zoom
    this.interaction.onWheel(e => {
      this.viewport.scrollZoom(e.deltaY, e.offsetX, e.offsetY);
    });

    // Start render loop
    this.start();
  }

  /** Start the render loop. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  /** Stop the render loop. */
  stop(): void {
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  private loop = (): void => {
    if (!this.running) return;
    this.renderManager.frame();
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  /** Handle container resize. */
  resize(width: number, height: number): void {
    this.viewport.resize(width, height);
  }

  /** Full cleanup. */
  dispose(): void {
    this.stop();
    this.interaction.detach();
    this.renderManager.dispose();
    this.spatialIndex.clear();
    this.sceneGraph.clear();
  }
}
