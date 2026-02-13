export interface ContextPoint {
  x: number;
  y: number;
}

export type ContextMenuTarget =
  | { type: 'canvas'; hitNodeId: string | null }
  | { type: 'page'; pageId: string }
  | { type: 'node'; nodeId: string }
  | { type: 'selection' };

export interface ContextMenuActionItem {
  id: string;
  kind: 'action';
  label: string;
  shortcut?: string;
  disabled?: boolean;
  action: () => void;
}

export interface ContextMenuSeparatorItem {
  id: string;
  kind: 'separator';
}

export type ContextMenuItem = ContextMenuActionItem | ContextMenuSeparatorItem;
