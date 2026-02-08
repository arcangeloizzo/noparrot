-- Fix 1: Età minima 16 anni (GDPR Art.8)
-- Rimuovi il vecchio constraint e aggiungi il nuovo
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS check_min_age;

ALTER TABLE profiles 
ADD CONSTRAINT check_min_age 
CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE - INTERVAL '16 years');

COMMENT ON CONSTRAINT check_min_age ON profiles IS 
'GDPR Art.8: consenso digitale valido solo da 16 anni in UE';