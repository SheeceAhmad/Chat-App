-- Add profile_photo column to users table
ALTER TABLE users
ADD COLUMN profile_photo TEXT;
 
-- Add comment to explain the column
COMMENT ON COLUMN users.profile_photo IS 'URL to the user''s profile photo stored in Supabase Storage'; 