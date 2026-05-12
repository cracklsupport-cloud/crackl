-- ====================================================================
-- CRACKL: Multi-Format Riddle Studio — Database Migration
-- Run this in your Supabase SQL Editor
-- ====================================================================

-- 1. Add riddle_type column — categorizes the riddle format
--    Values: 'text', 'image_text', 'image_only', 'rebus', 'sequence'
--    Default 'text' ensures all existing riddles remain unchanged
ALTER TABLE riddles
ADD COLUMN IF NOT EXISTS riddle_type TEXT DEFAULT 'text';

-- 2. Add media_url column — stores the public URL of uploaded images
--    Used when riddle_type is 'image_text', 'image_only', or 'rebus'
ALTER TABLE riddles
ADD COLUMN IF NOT EXISTS media_url TEXT DEFAULT NULL;

-- 3. Add layout_config column — stores custom layout positions as JSON
--    Contains element positions, sizes, styles from the drag editor
--    When NULL, the GameScreen uses default text-only rendering
ALTER TABLE riddles
ADD COLUMN IF NOT EXISTS layout_config JSONB DEFAULT NULL;

-- 4. Create the riddle-media storage bucket (if not already present)
--    This stores uploaded images for image-based riddles
INSERT INTO storage.buckets (id, name, public)
VALUES ('riddle-media', 'riddle-media', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Allow public read access to uploaded riddle images
--    (Players need to see images when playing riddles)
CREATE POLICY "Public read access for riddle media"
ON storage.objects FOR SELECT
USING (bucket_id = 'riddle-media');

-- 6. Allow authenticated uploads (admin uploads via service key)
--    The backend uses the service/anon key, so this allows inserts
CREATE POLICY "Allow uploads to riddle media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'riddle-media');

-- 7. Allow admin to delete/overwrite uploaded media
CREATE POLICY "Allow delete from riddle media"
ON storage.objects FOR DELETE
USING (bucket_id = 'riddle-media');

-- ====================================================================
-- VERIFICATION: Run this after the migration to confirm it worked
-- ====================================================================
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'riddles'
--   AND column_name IN ('riddle_type', 'media_url', 'layout_config');
