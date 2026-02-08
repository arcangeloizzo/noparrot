-- Standardizza le categorie da inglese a italiano
UPDATE posts
SET category = CASE 
  WHEN category = 'Politics & Society' THEN 'Società & Politica'
  WHEN category = 'Technology & Innovation' THEN 'Scienza & Tecnologia'
  WHEN category = 'Science & Health' THEN 'Salute & Benessere'
  WHEN category = 'Business & Economy' THEN 'Economia & Business'
  WHEN category = 'Culture & Entertainment' THEN 'Cultura & Arte'
  WHEN category = 'Sports' THEN 'Sport & Lifestyle'
  WHEN category = 'Environment & Climate' THEN 'Pianeta & Ambiente'
  WHEN category = 'Education & Learning' THEN 'Media & Comunicazione'
  ELSE category
END
WHERE category IN (
  'Politics & Society',
  'Technology & Innovation', 
  'Science & Health',
  'Business & Economy',
  'Culture & Entertainment',
  'Sports',
  'Environment & Climate',
  'Education & Learning'
);