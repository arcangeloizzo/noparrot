-- Final cleanup: Remove deprecated sensitive column from public comments table
-- Data has already been migrated to private comment_cognitive_metrics table

ALTER TABLE public.comments DROP COLUMN user_density_before_comment;