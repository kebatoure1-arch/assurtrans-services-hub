-- 0006_authentification.sql
--
-- Authentification par telephone, sans dependance a un fournisseur d'identite externe.
--
-- Le code n'est jamais stocke en clair : seule son empreinte l'est, et cette empreinte est liee
-- au numero. Un code intercepte ne vaut rien sur une autre ligne.

BEGIN;

CREATE TABLE otp_challenges (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  msisdn         TEXT NOT NULL,
  code_hash      TEXT NOT NULL,
  emis_a         TIMESTAMPTZ NOT NULL,
  expire_a       TIMESTAMPTZ NOT NULL,
  tentatives     INT NOT NULL DEFAULT 0,
  max_tentatives INT NOT NULL,
  consomme       BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT otp_code_hash_sha256 CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT otp_expiration_apres_emission CHECK (expire_a > emis_a),
  CONSTRAINT otp_tentatives_bornees CHECK (tentatives >= 0 AND tentatives <= max_tentatives),
  CONSTRAINT otp_msisdn_e164 CHECK (msisdn ~ '^\+[1-9][0-9]{7,14}$')
);

-- Sert la limitation de debit : combien de codes demandes recemment pour ce numero.
CREATE INDEX otp_challenges_par_numero ON otp_challenges (msisdn, emis_a DESC);

-- Un seul defi vivant par numero a la fois. Demander un nouveau code invalide le precedent.
CREATE UNIQUE INDEX otp_challenges_un_vivant_par_numero
  ON otp_challenges (msisdn)
  WHERE consomme = false;

-- Les jetons de session expirent. Un jeton sans expiration est un mot de passe permanent.
ALTER TABLE api_tokens ADD COLUMN expire_a TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Operateurs : pompistes et administrateurs.
--
-- Les chauffeurs sont deja dans `drivers`, avec leur numero. Les autres roles avaient leur
-- identite dispersee dans les jetons d'API, ce qui ne permettait pas de les authentifier par
-- telephone. Cette table leur donne la meme porte d'entree.
-- ---------------------------------------------------------------------------

CREATE TABLE operateurs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT NOT NULL,
  msisdn      TEXT NOT NULL UNIQUE,
  role        api_role NOT NULL,
  station_id  UUID REFERENCES stations(id),
  statut      TEXT NOT NULL DEFAULT 'ACTIF' CHECK (statut IN ('ACTIF', 'SUSPENDU')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT operateurs_msisdn_e164 CHECK (msisdn ~ '^\+[1-9][0-9]{7,14}$'),
  CONSTRAINT operateurs_role_non_chauffeur CHECK (role <> 'DRIVER'),
  CONSTRAINT operateurs_pompiste_rattache CHECK (role <> 'STATION_OPERATOR' OR station_id IS NOT NULL)
);

COMMIT;
