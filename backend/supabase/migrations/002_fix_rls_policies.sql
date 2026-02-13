-- ============================================================================
-- Wigma — Fix RLS infinite recursion on project_users
-- Run this in Supabase Dashboard → SQL Editor BEFORE re-applying policies.
-- ============================================================================

-- ── Drop all existing policies ──────────────────────────────────────────────

DROP POLICY IF EXISTS projects_select ON projects;
DROP POLICY IF EXISTS projects_insert ON projects;
DROP POLICY IF EXISTS projects_update ON projects;
DROP POLICY IF EXISTS projects_delete ON projects;

DROP POLICY IF EXISTS project_users_select ON project_users;
DROP POLICY IF EXISTS project_users_insert ON project_users;
DROP POLICY IF EXISTS project_users_delete ON project_users;

DROP POLICY IF EXISTS yjs_snapshots_select ON yjs_snapshots;
DROP POLICY IF EXISTS yjs_snapshots_upsert ON yjs_snapshots;

DROP POLICY IF EXISTS yjs_updates_select ON yjs_updates;
DROP POLICY IF EXISTS yjs_updates_insert ON yjs_updates;

DROP POLICY IF EXISTS media_select ON media_files;
DROP POLICY IF EXISTS media_insert ON media_files;

-- Profiles: removed — no profiles table

-- ── Drop old helper functions if they exist ─────────────────────────────────

DROP FUNCTION IF EXISTS is_project_member(UUID);
DROP FUNCTION IF EXISTS get_project_role(UUID);
DROP FUNCTION IF EXISTS is_project_editor(UUID);

-- ── Create SECURITY DEFINER helpers (bypass RLS to break circular refs) ─────

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

-- ── Re-create all policies using the helpers ────────────────────────────────

-- Projects
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

-- Project users
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

-- Yjs snapshots
CREATE POLICY yjs_snapshots_select ON yjs_snapshots FOR SELECT USING (
  is_project_member(project_id)
);
CREATE POLICY yjs_snapshots_upsert ON yjs_snapshots FOR ALL USING (
  is_project_editor(project_id)
);

-- Yjs updates
CREATE POLICY yjs_updates_select ON yjs_updates FOR SELECT USING (
  is_project_member(project_id)
);
CREATE POLICY yjs_updates_insert ON yjs_updates FOR INSERT WITH CHECK (
  is_project_editor(project_id)
);

-- Media files
CREATE POLICY media_select ON media_files FOR SELECT USING (
  is_project_member(project_id)
);
CREATE POLICY media_insert ON media_files FOR INSERT WITH CHECK (
  is_project_editor(project_id)
);

-- Profiles: removed — no profiles table
