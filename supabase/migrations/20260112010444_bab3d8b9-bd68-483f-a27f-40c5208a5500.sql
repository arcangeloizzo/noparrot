-- Add verified_by column to posts table
ALTER TABLE posts 
ADD COLUMN verified_by text DEFAULT 'ai_quiz';

-- Update existing Intent posts
UPDATE posts 
SET verified_by = 'user_intent' 
WHERE is_intent = true;

-- Create trigger to automatically set verified_by for new Intent posts
CREATE OR REPLACE FUNCTION set_verified_by_on_intent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_intent = true THEN
    NEW.verified_by := 'user_intent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_verified_by_trigger
BEFORE INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION set_verified_by_on_intent();