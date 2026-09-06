-- 0001_init.sql — Socle du module de règlement carburant post-payé
-- Montants : ENTIERS en XOF. Le franc CFA n'a pas de subdivision utilisée.
-- Aucune colonne NUMERIC/DECIMAL/FLOAT n'est autorisée pour un montant.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------- référentiel

CREATE TABLE entities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raison_sociale  TEXT        NOT NULL,
  ninea           TEXT,
  rccm            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE canal_reglement AS ENUM ('DRY_RUN', 'B2B', 'MOBILE');

CREATE TABLE te_contracts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id              UUID NOT NULL REFERENCES entities(id),
  numero_compte_te       TEXT NOT NULL,
  encours_autorise       BIGINT NOT NULL,
  delai_reglement_jours  INT    NOT NULL,
  seuil_alerte_pct       INT    NOT NULL DEFAULT 70,
  seuil_blocage_pct      INT    NOT NULL DEFAULT 90,
  canal_reglement        canal_reglement NOT NULL DEFAULT 'DRY_RUN',
  te_b2b_id              TEXT,
  te_msisdn              TEXT,
  reference_imputation   TEXT,       -- gabarit fourni par TE (§14 param. 2)
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT te_contracts_encours_positif   CHECK (encours_autorise > 0),
  CONSTRAINT te_contracts_delai_positif     CHECK (delai_reglement_jours > 0),
  CONSTRAINT te_contracts_seuils_coherents  CHECK (seuil_alerte_pct > 0
                                              AND seuil_alerte_pct < seuil_blocage_pct
                                              AND seuil_blocage_pct <= 100),
  -- Le bénéficiaire exigé par le canal doit être présent. DRY_RUN n'en exige aucun.
  CONSTRAINT te_contracts_beneficiaire CHECK (
       (canal_reglement = 'DRY_RUN')
    OR (canal_reglement = 'B2B'    AND te_b2b_id IS NOT NULL)
    OR (canal_reglement = 'MOBILE' AND te_msisdn IS NOT NULL)
  ),
  UNIQUE (entity_id, numero_compte_te)
);

CREATE TYPE card_statut AS ENUM ('ACTIVE', 'SUSPENDUE', 'RESILIEE');

CREATE TABLE cards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id      UUID NOT NULL REFERENCES te_contracts(id),
  pan_masque       TEXT NOT NULL,               -- JAMAIS le PAN complet
  conducteur       TEXT,
  immatriculation  TEXT,
  plafond_mensuel  BIGINT,
  statut           card_statut NOT NULL DEFAULT 'ACTIVE',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cards_plafond_positif CHECK (plafond_mensuel IS NULL OR plafond_mensuel > 0),
  -- Garde-fou : un PAN complet (12 chiffres consécutifs ou plus) est refusé en base.
  CONSTRAINT cards_pan_masque_only CHECK (pan_masque !~ '[0-9]{12}')
);

-- ---------------------------------------------------------------- consommation

CREATE TABLE card_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id      UUID NOT NULL REFERENCES cards(id),
  date_tx      DATE NOT NULL,
  station      TEXT,
  produit      TEXT,
  litres_x100  INT,                              -- centilitres, entier. Pas de flottant.
  montant_xof  BIGINT NOT NULL,
  source       TEXT NOT NULL,                    -- 'IMPORT_CSV_TE' | 'SAISIE_MANUELLE'
  import_hash  TEXT NOT NULL,                    -- dédup d'import
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT card_tx_montant_positif CHECK (montant_xof > 0),
  CONSTRAINT card_tx_litres_positif  CHECK (litres_x100 IS NULL OR litres_x100 > 0)
);

-- Un même relevé réimporté ne duplique pas la consommation.
CREATE UNIQUE INDEX card_transactions_dedup ON card_transactions (card_id, import_hash);
CREATE INDEX card_transactions_by_date ON card_transactions (card_id, date_tx);

-- ---------------------------------------------------------------- factures

CREATE TYPE invoice_statut AS ENUM ('OUVERTE', 'ORDONNANCEE', 'REGLEE', 'LETTREE', 'LITIGE');

CREATE TABLE invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id    UUID NOT NULL REFERENCES te_contracts(id),
  numero         TEXT NOT NULL,
  periode_debut  DATE NOT NULL,
  periode_fin    DATE NOT NULL,
  montant_xof    BIGINT NOT NULL,
  date_emission  DATE NOT NULL,
  date_echeance  DATE NOT NULL,
  fichier_id     TEXT,
  statut         invoice_statut NOT NULL DEFAULT 'OUVERTE',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT invoices_montant_positif CHECK (montant_xof > 0),
  CONSTRAINT invoices_periode_ordonnee CHECK (periode_debut <= periode_fin),
  CONSTRAINT invoices_echeance_apres_emission CHECK (date_echeance >= date_emission),
  UNIQUE (contract_id, numero)
);

-- ---------------------------------------------------------------- règlement

CREATE TYPE payment_intent_statut AS ENUM (
  'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DISPATCHING', 'SENT',
  'SETTLED', 'RECONCILED', 'NEEDS_REVIEW', 'FAILED', 'VARIANCE', 'CANCELLED'
);

CREATE TABLE payment_intents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id            UUID NOT NULL REFERENCES invoices(id),  -- ADR-001 : jamais de payout hors facture
  montant_xof           BIGINT NOT NULL,
  statut                payment_intent_statut NOT NULL DEFAULT 'DRAFT',
  idempotency_key       UUID NOT NULL,
  wave_payout_id        TEXT,
  canal                 canal_reglement NOT NULL,
  reference_imputation  TEXT,
  prepare_par           TEXT NOT NULL,
  approuve_par          TEXT,
  execute_par           TEXT,
  motif_review          TEXT,
  ts_created            TIMESTAMPTZ NOT NULL DEFAULT now(),
  ts_approved           TIMESTAMPTZ,
  ts_dispatching        TIMESTAMPTZ,
  ts_sent               TIMESTAMPTZ,
  ts_settled            TIMESTAMPTZ,

  CONSTRAINT pi_montant_positif CHECK (montant_xof > 0),
  -- §9 : séparation des rôles. Un préparateur ne peut pas approuver sa propre intention.
  CONSTRAINT pi_separation_des_roles CHECK (approuve_par IS NULL OR approuve_par <> prepare_par)
);

-- §11 : rejouer 5x le même job d'échéance ⇒ exactement 1 intention.
CREATE UNIQUE INDEX payment_intents_idempotency ON payment_intents (idempotency_key);

-- Une facture ne peut porter qu'une seule intention vivante à la fois.
CREATE UNIQUE INDEX payment_intents_une_vivante_par_facture
  ON payment_intents (invoice_id)
  WHERE statut NOT IN ('FAILED', 'CANCELLED');

-- ---------------------------------------------------------------- relevé Wave

CREATE TABLE wave_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_tx_id    TEXT NOT NULL UNIQUE,
  date_tx       TIMESTAMPTZ NOT NULL,
  sens          TEXT NOT NULL CHECK (sens IN ('IN', 'OUT')),
  montant_xof   BIGINT NOT NULL,
  contrepartie  TEXT,
  raw_json      JSONB NOT NULL,
  imported_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT wave_tx_montant_positif CHECK (montant_xof > 0)
);

-- ---------------------------------------------------------------- rapprochement

CREATE TYPE reconciliation_statut AS ENUM ('MATCHED', 'VARIANCE', 'ORPHAN');

CREATE TABLE reconciliations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periode             DATE NOT NULL,
  invoice_id          UUID REFERENCES invoices(id),
  payment_intent_id   UUID REFERENCES payment_intents(id),
  wave_transaction_id UUID REFERENCES wave_transactions(id),
  ecart_xof           BIGINT NOT NULL DEFAULT 0,
  statut              reconciliation_statut NOT NULL,
  resolu_par          TEXT,
  resolu_at           TIMESTAMPTZ,
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Aucun état silencieux : une ligne pointe toujours vers au moins une des trois voies.
  CONSTRAINT reconciliations_non_vide CHECK (
    invoice_id IS NOT NULL OR payment_intent_id IS NOT NULL OR wave_transaction_id IS NOT NULL
  ),
  CONSTRAINT reconciliations_matched_sans_ecart CHECK (statut <> 'MATCHED' OR ecart_xof = 0)
);

-- ---------------------------------------------------------------- webhooks

CREATE TABLE webhook_events (
  event_id     TEXT PRIMARY KEY,                -- dédup §11 : 5 rejeux ⇒ 1 transition
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type   TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  processed_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------- audit

CREATE TABLE audit_events (
  id           BIGSERIAL PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor        TEXT NOT NULL,
  action       TEXT NOT NULL,
  target_type  TEXT NOT NULL,
  target_id    TEXT NOT NULL,
  payload_hash TEXT NOT NULL
);

-- Append-only : aucune écriture applicative ne peut modifier ni supprimer un événement d'audit.
CREATE RULE audit_events_no_update AS ON UPDATE TO audit_events DO INSTEAD NOTHING;
CREATE RULE audit_events_no_delete AS ON DELETE TO audit_events DO INSTEAD NOTHING;

-- ---------------------------------------------------------------- verrou scheduler

CREATE TABLE job_locks (
  job_name    TEXT PRIMARY KEY,
  locked_by   TEXT NOT NULL,
  locked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);

COMMIT;
