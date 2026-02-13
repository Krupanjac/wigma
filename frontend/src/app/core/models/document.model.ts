import { SceneNodeModel } from './scene-node.model';

/**
 * Document model for project persistence.
 */
export interface DocumentModel {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  canvas: {
    width: number;
    height: number;
    backgroundColor: number;
  };
  nodes: SceneNodeModel[];
  /**
   * Content-addressed asset table (hash → data URL).
   * Large media blobs are stored here once; nodes reference them
   * via `asset:<hash>` strings in their `data` fields.
   */
  assets?: Record<string, string>;
}

/**
 * Page within a document (for multi-page support).
 */
export interface PageModel {
  id: string;
  name: string;
  nodes: SceneNodeModel[];
}
