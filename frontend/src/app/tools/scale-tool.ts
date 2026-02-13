import { ToolType } from './base-tool';
import { SelectTool } from './select-tool';
import { CanvasEngine } from '../engine/canvas-engine';
import { TransformAnchor } from '../shared/transform-anchor';

/**
 * ScaleTool — dedicated transform tool (same interaction model as Select).
 */
export class ScaleTool extends SelectTool {
  override readonly type: ToolType = 'scale';
  override readonly label = 'Scale';
  override readonly icon = 'scale';
  override readonly shortcut = 'K';

  constructor(engine: CanvasEngine, private readonly anchorProvider: () => TransformAnchor) {
    super(engine);
  }

  protected override getTransformAnchor(): TransformAnchor {
    return this.anchorProvider();
  }
}
