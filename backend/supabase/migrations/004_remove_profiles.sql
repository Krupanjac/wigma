-- ============================================================================
-- Wigma — Remove profiles table
-- User data now comes from Supabase auth.users (user_metadata).
-- No separate profiles table needed.
-- Run this in Supabase Dashboard → SQL Editor.
-- ============================================================================

-- Drop the trigger that auto-created profile rows on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Drop the profiles table entirely (if it exists)
DROP TABLE IF EXISTS profiles CASCADE;
