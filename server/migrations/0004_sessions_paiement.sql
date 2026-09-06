-- 0004_sessions_paiement.sql
--
-- Mémoire des sessions de paiement ouvertes.
--
-- Sans elle, le webhook de confirmation ne peut répondre à deux questions indispensables :
-- « quel chauffeur a payé ? » et « le montant reçu est-il bien celui que nous avons demandé ? ».
-- Un webhook qui annonce un montant différent de celui demandé n'émet aucun bon.

BEGIN;

CREATE TABLE checkout_sessions (
  reference    TEXT PRIMARY KEY,
  driver_id    UUID NOT NULL REFERENCES drivers(id),
  montant_xof  BIGINT NOT NULL,
  canal        TEXT NOT NULL,
  session_id   TEXT,
  cree_a       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT checkout_sessions_montant_positif CHECK (montant_xof > 0)
);

CREATE INDEX checkout_sessions_par_chauffeur ON checkout_sessions (driver_id, cree_a DESC);

COMMIT;
