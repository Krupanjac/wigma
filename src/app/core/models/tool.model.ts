import { ToolType } from '../../tools/base-tool';

/**
 * Tool model for UI representation.
 */
export interface ToolModel {
  type: ToolType;
  label: string;
  icon: string;
  shortcut: string;
  group?: string;
}

/**
 * Standard tool definitions for the toolbar.
 */
export const TOOL_DEFINITIONS: ToolModel[] = [
  { type: 'select', label: 'Select', icon: 'cursor', shortcut: 'V', group: 'selection' },
  { type: 'rectangle', label: 'Rectangle', icon: 'square', shortcut: 'R', group: 'shapes' },
  { type: 'ellipse', label: 'Ellipse', icon: 'circle', shortcut: 'O', group: 'shapes' },
  { type: 'polygon', label: 'Polygon', icon: 'pentagon', shortcut: 'P', group: 'shapes' },
  { type: 'star', label: 'Star', icon: 'star', shortcut: 'S', group: 'shapes' },
  { type: 'line', label: 'Line', icon: 'minus', shortcut: 'L', group: 'drawing' },
  { type: 'arrow', label: 'Arrow', icon: 'arrow-right', shortcut: 'A', group: 'drawing' },
  { type: 'pen', label: 'Pen', icon: 'pen-tool', shortcut: 'P', group: 'drawing' },
  { type: 'text', label: 'Text', icon: 'type', shortcut: 'T', group: 'content' },
  { type: 'hand', label: 'Hand', icon: 'hand', shortcut: 'H', group: 'navigation' },
  { type: 'zoom', label: 'Zoom', icon: 'zoom-in', shortcut: 'Z', group: 'navigation' },
];
