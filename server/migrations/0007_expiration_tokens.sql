-- 0007_expiration_tokens.sql
--
-- Les jetons historiques créés avant l'authentification par téléphone pouvaient ne pas avoir
-- d'expiration. Ils sont révoqués avant de rendre l'expiration obligatoire.

BEGIN;

UPDATE api_tokens
SET revoque_a = COALESCE(revoque_a, now())
WHERE expire_a IS NULL;

ALTER TABLE api_tokens
  ALTER COLUMN expire_a SET NOT NULL;

COMMIT;