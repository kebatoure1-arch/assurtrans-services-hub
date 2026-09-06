-- 0003_acces_api.sql
--
-- Accès à l'API. Trois rôles seulement en v1 :
--   DRIVER            — ouvre une session de paiement, consulte ses bons
--   STATION_OPERATOR  — consomme un bon en station
--   ADMIN             — référentiel, annulations, rapprochement
--
-- Le jeton n'est JAMAIS stocké en clair : seule son empreinte l'est. Une fuite de la base ne
-- donne pas la capacité d'appeler l'API.

BEGIN;

CREATE TYPE api_role AS ENUM ('DRIVER', 'STATION_OPERATOR', 'ADMIN');

CREATE TABLE api_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role         api_role NOT NULL,
  /* Identifiant du porteur : drivers.id pour un chauffeur, matricule pour un pompiste. */
  subject      TEXT NOT NULL,
  /* SHA-256 du jeton, en hexadécimal. 64 caractères, jamais le jeton lui-même. */
  token_hash   TEXT NOT NULL UNIQUE,
  /* Station de rattachement. Obligatoire pour un pompiste : il ne consomme que chez lui. */
  station_id   UUID REFERENCES stations(id),
  libelle      TEXT,
  cree_a       TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoque_a    TIMESTAMPTZ,
  dernier_usage TIMESTAMPTZ,

  CONSTRAINT api_tokens_hash_sha256 CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT api_tokens_pompiste_rattache CHECK (role <> 'STATION_OPERATOR' OR station_id IS NOT NULL)
);

CREATE INDEX api_tokens_actifs ON api_tokens (role) WHERE revoque_a IS NULL;

COMMIT;
