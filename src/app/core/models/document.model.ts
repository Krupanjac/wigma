import { SceneNodeModel } from './scene-node.model';

/**
 * Document model for project persistence.
 */
export interface DocumentModel {
  id: string;
  name: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  canvas: {
    width: number;
    height: number;
    backgroundColor: number;
  };
  nodes: SceneNodeModel[];
}

/**
 * Page within a document (for multi-page support).
 */
export interface PageModel {
  id: string;
  name: string;
  nodes: SceneNodeModel[];
}
