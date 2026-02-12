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

export type ToolGroupId =
  | 'selection'
  | 'container'
  | 'geometry'
  | 'drawing'
  | 'text'
  | 'comment';

export interface ToolGroupModel {
  id: ToolGroupId;
  label: string;
  tools: ToolType[];
}

/**
 * Standard tool definitions for the toolbar.
 */
export const TOOL_DEFINITIONS: ToolModel[] = [
  { type: 'select', label: 'Select', icon: 'cursor', shortcut: 'V', group: 'selection' },
  { type: 'scale', label: 'Scale', icon: 'scale', shortcut: 'K', group: 'selection' },
  { type: 'hand', label: 'Hand', icon: 'hand', shortcut: 'H', group: 'selection' },

  { type: 'frame', label: 'Frame', icon: 'frame', shortcut: 'F', group: 'container' },
  { type: 'section', label: 'Section', icon: 'section', shortcut: 'Shift+S', group: 'container' },
  { type: 'slice', label: 'Slice', icon: 'slice', shortcut: 'X', group: 'container' },

  { type: 'rectangle', label: 'Rectangle', icon: 'square', shortcut: 'R', group: 'shapes' },
  { type: 'ellipse', label: 'Ellipse', icon: 'circle', shortcut: 'O', group: 'shapes' },
  { type: 'polygon', label: 'Polygon', icon: 'pentagon', shortcut: '', group: 'shapes' },
  { type: 'star', label: 'Star', icon: 'star', shortcut: '', group: 'shapes' },
  { type: 'line', label: 'Line', icon: 'minus', shortcut: 'L', group: 'shapes' },
  { type: 'arrow', label: 'Arrow', icon: 'arrow-right', shortcut: 'A', group: 'shapes' },
  { type: 'image', label: 'Image', icon: 'image', shortcut: 'I', group: 'shapes' },
  { type: 'video', label: 'Video', icon: 'video', shortcut: 'Shift+V', group: 'shapes' },

  { type: 'pen', label: 'Pen', icon: 'pen-tool', shortcut: 'P', group: 'drawing' },
  { type: 'pencil', label: 'Pencil', icon: 'pencil', shortcut: 'B', group: 'drawing' },

  { type: 'text', label: 'Text', icon: 'type', shortcut: 'T', group: 'content' },
  { type: 'comment', label: 'Comment', icon: 'message-square', shortcut: 'C', group: 'content' },
];

export const TOOL_GROUPS: ToolGroupModel[] = [
  { id: 'selection', label: 'Selection', tools: ['select', 'hand', 'scale'] },
  { id: 'container', label: 'Frame/Section/Slice', tools: ['frame', 'section', 'slice'] },
  { id: 'geometry', label: 'Geometry', tools: ['rectangle', 'ellipse', 'polygon', 'star', 'line', 'arrow', 'image', 'video'] },
  { id: 'drawing', label: 'Pen/Pencil', tools: ['pen', 'pencil'] },
  { id: 'text', label: 'Text', tools: ['text'] },
  { id: 'comment', label: 'Comment', tools: ['comment'] },
];
