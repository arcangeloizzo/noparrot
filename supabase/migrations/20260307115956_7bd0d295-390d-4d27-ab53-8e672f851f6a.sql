
ALTER TABLE challenge_votes ADD COLUMN challenge_id uuid REFERENCES challenges(id);

UPDATE challenge_votes cv SET challenge_id = cr.challenge_id 
  FROM challenge_responses cr WHERE cr.id = cv.challenge_response_id;

ALTER TABLE challenge_votes ALTER COLUMN challenge_id SET NOT NULL;

ALTER TABLE challenge_votes ADD CONSTRAINT one_vote_per_user_per_challenge UNIQUE (user_id, challenge_id);
