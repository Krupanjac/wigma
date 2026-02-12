import { PointerEventData } from '../engine/interaction/interaction-manager';

/**
 * Tool type identifiers.
 */
export type ToolType =
  | 'select'
  | 'scale'
  | 'frame'
  | 'section'
  | 'slice'
  | 'rectangle'
  | 'ellipse'
  | 'polygon'
  | 'star'
  | 'line'
  | 'arrow'
  | 'pen'
  | 'pencil'
  | 'text'
  | 'image'
  | 'video'
  | 'comment'
  | 'hand'
  | 'zoom';

/**
 * Abstract base class for all tools.
 *
 * Tools implement a state machine driven by pointer and keyboard events.
 * The ToolManager activates/deactivates tools and delegates events.
 */
export abstract class BaseTool {
  abstract readonly type: ToolType;
  abstract readonly label: string;
  abstract readonly icon: string;
  abstract readonly shortcut: string;

  /** Called when this tool becomes the active tool. */
  onActivate(): void {}

  /** Called when this tool is replaced by another. */
  onDeactivate(): void {}

  /** Pointer down on canvas. */
  onPointerDown(_event: PointerEventData): void {}

  /** Pointer move on canvas. */
  onPointerMove(_event: PointerEventData): void {}

  /** Pointer up on canvas. */
  onPointerUp(_event: PointerEventData): void {}

  /** Key down while tool is active. */
  onKeyDown(_event: KeyboardEvent): void {}

  /** Key up while tool is active. */
  onKeyUp(_event: KeyboardEvent): void {}
}
