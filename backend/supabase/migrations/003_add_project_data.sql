-- ============================================================================
-- Wigma — Add project_data column for scene graph persistence
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================================

-- Store the full document JSON (nodes, canvas config, etc.) directly on the
-- projects table. This is the simplest persistence model: one JSONB column
-- holds the entire scene graph. Later, Yjs CRDT can replace this for real-time.

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS project_data JSONB DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN projects.project_data IS
  'Full document scene graph (nodes, layers, geometry) stored as JSONB. NULL = empty project.';
