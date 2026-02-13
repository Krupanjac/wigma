/**
 * Shared Database Types — Auto-generated from Supabase schema.
 * Used by both frontend Angular client and backend C++ server (via JSON).
 *
 * These types mirror the PostgreSQL tables 1:1 and are the source of truth
 * for all API contracts and Supabase client typings.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export type ProjectRole = 'owner' | 'editor' | 'viewer';

export type NodeType =
  | 'rectangle'
  | 'ellipse'
  | 'polygon'
  | 'star'
  | 'line'
  | 'arrow'
  | 'text'
  | 'image'
  | 'video'
  | 'path'
  | 'group';

// ── Value Objects ────────────────────────────────────────────────────────────

/** RGBA color in 0–1 range. */
export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface CanvasConfig {
  width: number;
  height: number;
  backgroundColor: number;
}

export interface FillStyle {
  color: Color;
  visible: boolean;
}

export interface StrokeStyle {
  color: Color;
  width: number;
  visible: boolean;
}

// ── Row Types (mirror Supabase tables) ───────────────────────────────────────

export interface DbProject {
  id: string;
  name: string;
  description: string;
  version: string;
  owner_id: string;
  canvas_config: CanvasConfig;
  thumbnail_path: string | null;
  /** Full document scene graph (nodes, layers, geometry). null = empty project. */
  project_data: DocumentData | null;
  created_at: string;
  updated_at: string;
}

/** The shape stored in the project_data JSONB column. */
export interface DocumentData {
  nodes: SceneNodeModel[];
  canvas: CanvasConfig;
}

export interface DbProjectUser {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  invited_at: string;
}

export interface DbYjsSnapshot {
  project_id: string;
  snapshot: Uint8Array;
  updated_at: string;
}

export interface DbYjsUpdate {
  id: number;
  project_id: string;
  data: Uint8Array;
  created_at: string;
}

export interface DbMediaFile {
  id: string;
  project_id: string;
  uploader_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface DbProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  cursor_color: string;
  created_at: string;
  updated_at: string;
}

// ── Scene Node Model (shared between FE persistence and Yjs CRDT) ────────────

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
  fill: FillStyle;
  stroke: StrokeStyle;
  opacity: number;
  visible: boolean;
  locked: boolean;
  parentId: string | null;
  children: SceneNodeModel[];
  /** Type-specific data (cornerRadius, sides, anchors, points, src, etc.) */
  data: Record<string, unknown>;
}

// ── Document Model (full project snapshot for import/export) ──────────────────

export interface DocumentModel {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  canvas: CanvasConfig;
  nodes: SceneNodeModel[];
}

export interface PageModel {
  id: string;
  name: string;
  nodes: SceneNodeModel[];
}

// ── Insert Types (for Supabase .insert()) ────────────────────────────────────

export type ProjectInsert = Pick<DbProject, 'name' | 'owner_id'> &
  Partial<Pick<DbProject, 'description' | 'version' | 'canvas_config' | 'thumbnail_path'>>;

export type ProjectUpdate = Partial<
  Pick<DbProject, 'name' | 'description' | 'canvas_config' | 'thumbnail_path' | 'project_data'>
>;

export type ProjectUserInsert = Pick<DbProjectUser, 'project_id' | 'user_id'> &
  Partial<Pick<DbProjectUser, 'role'>>;

export type MediaFileInsert = Pick<
  DbMediaFile,
  'project_id' | 'uploader_id' | 'storage_path' | 'mime_type'
> &
  Partial<Pick<DbMediaFile, 'size_bytes' | 'width' | 'height'>>;

export type ProfileUpdate = Partial<Pick<DbProfile, 'display_name' | 'avatar_url' | 'cursor_color'>>;

// ── WebSocket Protocol Messages ──────────────────────────────────────────────

export type WsClientMessage =
  | { type: 'join'; projectId: string; token: string }
  | { type: 'yjs-update'; data: Uint8Array }
  | { type: 'awareness'; data: Uint8Array }
  | { type: 'ping' };

export type WsServerMessage =
  | { type: 'joined'; userId: string; peers: string[] }
  | { type: 'yjs-sync'; data: Uint8Array }
  | { type: 'yjs-update'; data: Uint8Array }
  | { type: 'awareness'; data: Uint8Array }
  | { type: 'peer-joined'; userId: string }
  | { type: 'peer-left'; userId: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong' };

// ── Supabase Database Type Map (for createClient<Database>) ──────────────────

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: DbProject;
        Insert: ProjectInsert;
        Update: ProjectUpdate;
      };
      project_users: {
        Row: DbProjectUser;
        Insert: ProjectUserInsert;
        Update: never;
      };
      yjs_snapshots: {
        Row: DbYjsSnapshot;
        Insert: Pick<DbYjsSnapshot, 'project_id' | 'snapshot'>;
        Update: Pick<DbYjsSnapshot, 'snapshot'>;
      };
      yjs_updates: {
        Row: DbYjsUpdate;
        Insert: Pick<DbYjsUpdate, 'project_id' | 'data'>;
        Update: never;
      };
      media_files: {
        Row: DbMediaFile;
        Insert: MediaFileInsert;
        Update: never;
      };
      profiles: {
        Row: DbProfile;
        Insert: Pick<DbProfile, 'id'> & Partial<Omit<DbProfile, 'id' | 'created_at' | 'updated_at'>>;
        Update: ProfileUpdate;
      };
    };
    Enums: {
      project_role: ProjectRole;
    };
  };
}
