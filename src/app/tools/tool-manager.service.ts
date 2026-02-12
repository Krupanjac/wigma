import { Injectable, signal, computed, inject } from '@angular/core';
import { BaseTool, ToolType } from './base-tool';
import { CanvasEngine } from '../engine/canvas-engine';
import { SelectTool } from './select-tool';
import { RectangleTool } from './rectangle-tool';
import { EllipseTool } from './ellipse-tool';
import { PolygonTool } from './polygon-tool';
import { StarTool } from './star-tool';
import { LineTool } from './line-tool';
import { ArrowTool } from './arrow-tool';
import { PenTool } from './pen-tool';
import { TextTool } from './text-tool';
import { HandTool } from './hand-tool';
import { ZoomTool } from './zoom-tool';
import { ScaleTool } from './scale-tool';
import { FrameTool } from './frame-tool';
import { SectionTool } from './section-tool';
import { SliceTool } from './slice-tool';
import { ImageTool } from './image-tool';
import { VideoTool } from './video-tool';
import { PencilTool } from './pencil-tool';
import { CommentTool } from './comment-tool';
import { TransformAnchorService } from '../core/services/transform-anchor.service';

/**
 * ToolManagerService — Angular service wrapping the OOP tool system.
 * Uses signals for reactive UI updates with OnPush components.
 */
@Injectable({
  providedIn: 'root'
})
export class ToolManagerService {
  private transformAnchor = inject(TransformAnchorService);
  private tools = new Map<ToolType, BaseTool>();
  private selectTool: SelectTool | null = null;
  private _activeTool = signal<BaseTool | null>(null);
  private _activeToolType = signal<ToolType>('select');

  readonly activeTool = computed(() => this._activeTool());
  readonly activeToolType = computed(() => this._activeToolType());

  private shouldAutoReturnToSelect(activeType: ToolType, engine: CanvasEngine): boolean {
    if (!this.selectTool) return false;
    if (!['rectangle', 'ellipse', 'polygon', 'star', 'line', 'arrow', 'text', 'frame', 'section', 'slice', 'image', 'video', 'comment'].includes(activeType)) {
      return false;
    }

    const selected = engine.selection.selectedNodes;
    if (selected.length !== 1) return false;

    const placedType = selected[0].type;
    return placedType === activeType;
  }

  /** Initialize tools with the engine instance. */
  init(engine: CanvasEngine): void {
    this.selectTool = new SelectTool(engine);
    this.tools.set('select', this.selectTool);
    this.tools.set('scale', new ScaleTool(engine, () => this.transformAnchor.anchor()));
    this.tools.set('frame', new FrameTool(engine));
    this.tools.set('section', new SectionTool(engine));
    this.tools.set('slice', new SliceTool(engine));
    this.tools.set('rectangle', new RectangleTool(engine));
    this.tools.set('ellipse', new EllipseTool(engine));
    this.tools.set('polygon', new PolygonTool(engine));
    this.tools.set('star', new StarTool(engine));
    this.tools.set('line', new LineTool(engine));
    this.tools.set('arrow', new ArrowTool(engine));
    this.tools.set('pen', new PenTool(engine));
    this.tools.set('pencil', new PencilTool(engine));
    this.tools.set('text', new TextTool(engine));
    this.tools.set('image', new ImageTool(engine));
    this.tools.set('video', new VideoTool(engine));
    this.tools.set('comment', new CommentTool(engine));
    this.tools.set('hand', new HandTool(engine));
    this.tools.set('zoom', new ZoomTool(engine));

    // Wire interaction events to active tool + global transform handles
    engine.interaction.onPointerDown(e => {
      const activeType = this._activeToolType();
      if (activeType !== 'select' && this.selectTool?.tryStartTransformInteraction(e)) {
        return;
      }
      this._activeTool()?.onPointerDown(e);
    });

    engine.interaction.onPointerMove(e => {
      const activeType = this._activeToolType();
      if (activeType !== 'select') {
        const consumed = this.selectTool?.handleTransformPointerMove(e) ?? false;
        if (consumed) return;
      }
      this._activeTool()?.onPointerMove(e);
    });

    engine.interaction.onPointerUp(e => {
      const activeType = this._activeToolType();
      if (activeType !== 'select' && this.selectTool?.handleTransformPointerUp(e)) {
        return;
      }
      this._activeTool()?.onPointerUp(e);

      if (activeType !== 'select' && this.shouldAutoReturnToSelect(activeType, engine)) {
        this.setTool('select');
      }
    });

    engine.interaction.onKeyDown(e => this._activeTool()?.onKeyDown(e));
    engine.interaction.onKeyUp(e => this._activeTool()?.onKeyUp(e));

    // Default to select tool
    this.setTool('select');
  }

  /** Switch to a different tool. */
  setTool(type: ToolType): void {
    const current = this._activeTool();
    if (current) {
      current.onDeactivate();
    }

    const tool = this.tools.get(type);
    if (tool) {
      this._activeTool.set(tool);
      this._activeToolType.set(type);
      tool.onActivate();
    }
  }

  /** Get a tool by type. */
  getTool(type: ToolType): BaseTool | undefined {
    return this.tools.get(type);
  }

  /** Get all registered tools. */
  getAllTools(): BaseTool[] {
    return Array.from(this.tools.values());
  }
}
