import { NodeType } from '../../engine/scene-graph/base-node';
import { Color } from '../../shared/utils/color-utils';

/**
 * Serializable scene node model (for persistence/clipboard).
 */
export interface SceneNodeModel {
  id: string;
  type: NodeType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  fill: { color: Color; visible: boolean };
  stroke: { color: Color; width: number; visible: boolean };
  opacity: number;
  visible: boolean;
  locked: boolean;
  parentId: string | null;
  children: SceneNodeModel[];
  /** Type-specific data (cornerRadius, sides, anchors, etc.) */
  data: Record<string, unknown>;
}
