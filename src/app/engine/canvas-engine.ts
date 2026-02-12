import { SceneGraphManager } from './scene-graph/scene-graph-manager';
import { SpatialIndex } from './spatial/spatial-index';
import { ViewportManager } from './viewport/viewport-manager';
import { SelectionManager } from './selection/selection-manager';
import { RenderManager } from './rendering/render-manager';
import { InteractionManager } from './interaction/interaction-manager';
import { HitTester } from './interaction/hit-tester';
import { SnapEngine } from './interaction/snap-engine';
import { GroupNode } from './scene-graph/group-node';
import { AlignmentIndex } from './interaction/alignment-index';
import { GuideState } from './interaction/guide-state';
import { BaseNode } from './scene-graph/base-node';

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

  /** Active page (root child group) where newly created nodes go. */
  activePageId: string | null = null;

  /** Hashmap-based alignment lookup + currently active guides. */
  readonly alignmentIndex: AlignmentIndex;
  readonly guides: GuideState;

  private activePageNodeIds = new Set<string>();
  private autoPageSelectionSuspendCount = 0;

  private running: boolean = false;
  private animationFrameId: number = 0;

  constructor() {
    this.sceneGraph = new SceneGraphManager();
    this.spatialIndex = new SpatialIndex();
    this.viewport = new ViewportManager();
    this.selection = new SelectionManager();
    this.snapEngine = new SnapEngine();
    this.alignmentIndex = new AlignmentIndex();
    this.guides = new GuideState();
    this.interaction = new InteractionManager(this.viewport);
    this.hitTester = new HitTester(this.sceneGraph, this.spatialIndex, node => this.isNodeInActivePage(node));
    this.renderManager = new RenderManager(
      this.sceneGraph, this.spatialIndex, this.viewport, this.selection, this.guides,
      node => this.isNodeInActivePage(node)
    );

    // Add default Page 1
    const page1 = new GroupNode('Page 1');
    page1.width = 0;
    page1.height = 0;
    this.sceneGraph.addNode(page1);
    this.activePageId = page1.id;
    this.rebuildActivePageNodeIds();
    this.ensureActivePageSelected();

    // Wire scene events to spatial index + alignment index
    this.sceneGraph.on(event => {
      switch (event.type) {
        case 'node-added':
          if (event.node !== this.sceneGraph.root) {
            this.spatialIndex.insert(event.node.id, event.node.worldBounds);

            // Index for alignment if it's not a top-level page
            if (event.node.parent !== this.sceneGraph.root) {
              this.alignmentIndex.upsertNode(event.node);
            }
          }
          break;
        case 'node-removed':
          this.spatialIndex.remove(event.node.id);
          this.alignmentIndex.removeNode(event.node.id);
          if (this.selection.isSelected(event.node.id)) {
            this.selection.removeFromSelection(event.node);
          }
          break;
        case 'node-changed':
          if (event.node.dirty.bounds) {
            this.spatialIndex.update(event.node.id, event.node.worldBounds);

            if (event.node.parent !== this.sceneGraph.root) {
              this.alignmentIndex.upsertNode(event.node);
            }
          }

          if (this.selection.isSelected(event.node.id)) {
            this.selection.notifyUpdated();
          }
          break;
        case 'hierarchy-changed':
          if (this.autoPageSelectionSuspendCount === 0) {
            this.ensureActivePageSelected();
            this.rebuildActivePageNodeIds();
          }
          break;
      }
    });
  }

  runWithoutAutoPageSelection<T>(operation: () => T): T {
    this.autoPageSelectionSuspendCount++;
    try {
      return operation();
    } finally {
      this.autoPageSelectionSuspendCount = Math.max(0, this.autoPageSelectionSuspendCount - 1);
      if (this.autoPageSelectionSuspendCount === 0) {
        this.ensureActivePageSelected();
        this.rebuildActivePageNodeIds();
      }
    }
  }

  get activePage(): GroupNode | null {
    if (this.activePageId) {
      const node = this.sceneGraph.getNode(this.activePageId);
      if (node && node.type === 'group' && node.parent === this.sceneGraph.root) {
        return node as GroupNode;
      }
    }

    this.ensureActivePageSelected();

    if (!this.activePageId) return null;
    const ensured = this.sceneGraph.getNode(this.activePageId);
    if (!ensured || ensured.type !== 'group' || ensured.parent !== this.sceneGraph.root) {
      return null;
    }

    return ensured as GroupNode;
  }

  setActivePage(id: string): void {
    const node = this.sceneGraph.getNode(id);
    if (!node || node.type !== 'group') return;
    if (node.parent !== this.sceneGraph.root) return;
    if (this.activePageId === id) return;
    this.activePageId = id;
    this.selection.clearSelection();
    this.guides.clear();
    this.rebuildActivePageNodeIds();
  }

  isNodeInActivePage(node: BaseNode): boolean {
    return this.activePageNodeIds.has(node.id);
  }

  /** True if the node is a top-level page (direct child of root). */
  isPageNode(node: BaseNode): boolean {
    return node.parent === this.sceneGraph.root;
  }

  private rebuildActivePageNodeIds(): void {
    this.activePageNodeIds.clear();

    const active = this.activePage;
    if (!active) return;

    // Only add descendants — the page itself must NOT be in the set
    // so it stays non-hittable, non-selectable, non-renderable on the canvas.
    for (const child of active.children) {
      const stack: BaseNode[] = [child];
      while (stack.length > 0) {
        const current = stack.pop()!;
        this.activePageNodeIds.add(current.id);
        for (const c of current.children) {
          stack.push(c);
        }
      }
    }
  }

  private ensureActivePageSelected(): void {
    if (this.activePageId) {
      const current = this.sceneGraph.getNode(this.activePageId);
      if (current && current.type === 'group' && current.parent === this.sceneGraph.root) {
        return;
      }
    }

    const firstPage = this.sceneGraph.root.children.find(n => n.type === 'group');
    if (firstPage) {
      this.activePageId = firstPage.id;
      this.rebuildActivePageNodeIds();
      return;
    }

    const page = new GroupNode('Page 1');
    page.width = 0;
    page.height = 0;
    this.sceneGraph.addNode(page);
    this.activePageId = page.id;
    this.rebuildActivePageNodeIds();
  }

  /**
   * Initialize the engine and attach to a container element.
   * Should be called inside NgZone.runOutsideAngular().
   */
  async init(container: HTMLElement): Promise<void> {
    await this.renderManager.init(container);

    this.interaction.attach(container);
    this.viewport.resize(container.clientWidth, container.clientHeight);

    // Figma-like trackpad/mouse mappings:
    // - Two-finger scroll / wheel pans
    // - Pinch-to-zoom (typically delivered as ctrl+wheel) zooms toward cursor
    this.interaction.onWheel(e => {
      if (e.ctrlKey) {
        this.viewport.scrollZoom(e.deltaY, e.offsetX, e.offsetY);
      } else {
        this.viewport.scrollPan(e.deltaX, e.deltaY);
      }
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
