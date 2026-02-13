-- ============================================================================
-- Wigma Backend — Initial Database Schema
-- Supabase PostgreSQL with Row-Level Security
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Projects ────────────────────────────────────────────────────────────────

CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL DEFAULT 'Untitled',
  description TEXT NOT NULL DEFAULT '',
  version     TEXT NOT NULL DEFAULT '1.0.0',
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  canvas_config JSONB NOT NULL DEFAULT '{"width": 1920, "height": 1080, "backgroundColor": 591115}'::jsonb,

  -- SSR thumbnail path in Supabase Storage
  thumbnail_path TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_owner ON projects(owner_id);

-- ── Project Users (collaboration membership) ────────────────────────────────

CREATE TYPE project_role AS ENUM ('owner', 'editor', 'viewer');

CREATE TABLE project_users (
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        project_role NOT NULL DEFAULT 'editor',
  invited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX idx_project_users_user ON project_users(user_id);

-- ── Yjs CRDT Persistence ────────────────────────────────────────────────────
-- Snapshot: full encoded Y.Doc state (compacted periodically)
-- Updates: incremental binary diffs between snapshots

CREATE TABLE yjs_snapshots (
  project_id  UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  snapshot    BYTEA NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE yjs_updates (
  id          BIGSERIAL PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data        BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_yjs_updates_project ON yjs_updates(project_id, id ASC);

-- ── Media Files ─────────────────────────────────────────────────────────────
-- Metadata rows; actual bytes stored in Supabase Storage "media" bucket.

CREATE TABLE media_files (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploader_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path  TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL DEFAULT 0,
  width         INT,
  height        INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_project ON media_files(project_id);

-- ── User Profiles (public read, self-write) ──────────────────────────────────

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url  TEXT,
  cursor_color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Auto-update updated_at trigger ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row-Level Security ──────────────────────────────────────────────────────

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE yjs_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE yjs_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ── SECURITY DEFINER helpers (bypass RLS to break circular references) ──────
-- These run as the function owner, so inner queries skip RLS on project_users.

CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_users
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION get_project_role(p_project_id UUID)
RETURNS project_role
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT role FROM project_users
  WHERE project_id = p_project_id AND user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_project_editor(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_users
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'editor')
  );
$$;

-- Projects: owner or members can read, owner/editors can write
CREATE POLICY projects_select ON projects FOR SELECT USING (
  owner_id = auth.uid() OR is_project_member(id)
);
CREATE POLICY projects_insert ON projects FOR INSERT WITH CHECK (
  owner_id = auth.uid()
);
CREATE POLICY projects_update ON projects FOR UPDATE USING (
  is_project_editor(id)
);
CREATE POLICY projects_delete ON projects FOR DELETE USING (
  owner_id = auth.uid()
);

-- Project users: members can see co-members, owner can manage
CREATE POLICY project_users_select ON project_users FOR SELECT USING (
  is_project_member(project_id)
);
CREATE POLICY project_users_insert ON project_users FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
);
CREATE POLICY project_users_delete ON project_users FOR DELETE USING (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    OR user_id = auth.uid()
);

-- Yjs: members can read, editors can write
CREATE POLICY yjs_snapshots_select ON yjs_snapshots FOR SELECT USING (
  is_project_member(project_id)
);
CREATE POLICY yjs_snapshots_upsert ON yjs_snapshots FOR ALL USING (
  is_project_editor(project_id)
);

CREATE POLICY yjs_updates_select ON yjs_updates FOR SELECT USING (
  is_project_member(project_id)
);
CREATE POLICY yjs_updates_insert ON yjs_updates FOR INSERT WITH CHECK (
  is_project_editor(project_id)
);

-- Media: project members can read, editors can upload
CREATE POLICY media_select ON media_files FOR SELECT USING (
  is_project_member(project_id)
);
CREATE POLICY media_insert ON media_files FOR INSERT WITH CHECK (
  is_project_editor(project_id)
);

-- Profiles: anyone can read, self can write
CREATE POLICY profiles_select ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (id = auth.uid());

-- ── Auto-create profile on user signup ──────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Auto-create project_users entry for owner ───────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_project()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_users (project_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_project_created
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION handle_new_project();

-- ── Storage bucket for media ────────────────────────────────────────────────
-- (Run via Supabase dashboard or CLI: supabase storage create media --public)
