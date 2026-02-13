-- ============================================================================
-- Wigma — Link-based Sharing
-- Adds a link_sharing flag to projects so authenticated users
-- can access a project by simply opening its URL.
--
-- When link_sharing = true:
--   1. Any authenticated user can SELECT the project row
--   2. A SECURITY DEFINER RPC auto-adds the visitor to project_users
--      so they gain full read/write through existing member RLS policies
-- ============================================================================

-- ── 1. Add link_sharing column ──────────────────────────────────────────────

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS link_sharing BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Replace projects_select policy ───────────────────────────────────────
-- Old: owner_id = auth.uid() OR is_project_member(id)
-- New: also allow any authenticated user if link_sharing = true

DROP POLICY IF EXISTS projects_select ON projects;

CREATE POLICY projects_select ON projects FOR SELECT USING (
  owner_id = auth.uid()
  OR is_project_member(id)
  OR (link_sharing = true AND auth.uid() IS NOT NULL)
);

-- ── 3. RPC: join_project_via_link ───────────────────────────────────────────
-- Called by the frontend when a user opens a shared project link.
-- Adds the calling user as 'editor' if the project has link_sharing enabled.
-- Returns true on success, false if link sharing is off or project not found.

CREATE OR REPLACE FUNCTION join_project_via_link(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link_sharing BOOLEAN;
BEGIN
  -- Check if project exists and has link sharing enabled
  SELECT link_sharing INTO v_link_sharing
  FROM projects
  WHERE id = p_project_id;

  IF v_link_sharing IS NULL OR v_link_sharing = false THEN
    RETURN false;
  END IF;

  -- Insert user as editor (no-op if already a member)
  INSERT INTO project_users (project_id, user_id, role)
  VALUES (p_project_id, auth.uid(), 'editor')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN true;
END;
$$;

-- ── 4. RPC: set_link_sharing ────────────────────────────────────────────────
-- Allows the project owner to toggle link sharing on/off.

CREATE OR REPLACE FUNCTION set_link_sharing(p_project_id UUID, p_enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE projects
  SET link_sharing = p_enabled
  WHERE id = p_project_id
    AND owner_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not the project owner or project not found';
  END IF;
END;
$$;
