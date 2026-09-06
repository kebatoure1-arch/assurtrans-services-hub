-- 0002_bons_carburant.sql
--
-- Chaîne v1 : le chauffeur paie → un bon est émis → le QR part sur WhatsApp →
-- le pompiste le consomme en station → la consommation alimente la facture TotalEnergies.
--
-- Le bon ne porte AUCUN solde. Un paiement produit un bon, d'un montant figé, à usage unique.
-- Voir docs/ADR-003-bon-carburant.md.

BEGIN;

-- ---------------------------------------------------------------- chauffeurs

CREATE TABLE drivers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   UUID NOT NULL REFERENCES entities(id),
  nom         TEXT NOT NULL,
  msisdn      TEXT NOT NULL,              -- destination WhatsApp du QR
  statut      TEXT NOT NULL DEFAULT 'ACTIF' CHECK (statut IN ('ACTIF', 'SUSPENDU')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Format E.164. Un numéro mal formé, c'est un QR envoyé à personne.
  CONSTRAINT drivers_msisdn_e164 CHECK (msisdn ~ '^\+[1-9][0-9]{7,14}$'),
  UNIQUE (entity_id, msisdn)
);

-- ---------------------------------------------------------------- stations

CREATE TABLE stations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  nom         TEXT NOT NULL,
  ville       TEXT,
  statut      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (statut IN ('ACTIVE', 'INACTIVE')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- encaissements

-- Paiement reçu d'un chauffeur. Chaque ligne finance exactement un bon.
CREATE TABLE driver_payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id    UUID NOT NULL REFERENCES drivers(id),
  montant_xof  BIGINT NOT NULL,
  canal        TEXT NOT NULL,              -- 'WAVE_CHECKOUT' | 'ESPECES' | ...
  reference    TEXT NOT NULL,              -- référence du prestataire d'encaissement
  recu_a       TIMESTAMPTZ NOT NULL,
  raw_json     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT driver_payments_montant_positif CHECK (montant_xof > 0),
  -- Un même encaissement rejoué (webhook) ne crée pas un second paiement.
  UNIQUE (canal, reference)
);

-- ---------------------------------------------------------------- bons

CREATE TYPE voucher_statut AS ENUM ('EMIS', 'CONSOMME', 'ANNULE');

CREATE TABLE fuel_vouchers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id         UUID NOT NULL REFERENCES drivers(id),
  payment_id        UUID NOT NULL REFERENCES driver_payments(id),
  montant_xof       BIGINT NOT NULL,
  statut            voucher_statut NOT NULL DEFAULT 'EMIS',
  emis_a            TIMESTAMPTZ NOT NULL,
  expire_a          TIMESTAMPTZ NOT NULL,

  consomme_a        TIMESTAMPTZ,
  station_id        UUID REFERENCES stations(id),
  operateur_id      TEXT,
  redemption_id     TEXT,
  motif_annulation  TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT vouchers_montant_positif CHECK (montant_xof > 0),
  CONSTRAINT vouchers_expiration_apres_emission CHECK (expire_a > emis_a),

  -- Un bon consommé porte TOUJOURS la trace de qui l'a servi, où et quand.
  -- Sans cette contrainte, un bon peut passer à CONSOMME sans trace exploitable.
  CONSTRAINT vouchers_consomme_trace CHECK (
    statut <> 'CONSOMME'
    OR (consomme_a IS NOT NULL AND station_id IS NOT NULL
        AND operateur_id IS NOT NULL AND redemption_id IS NOT NULL)
  ),
  CONSTRAINT vouchers_annule_motif CHECK (statut <> 'ANNULE' OR motif_annulation IS NOT NULL)
);

-- Un paiement ne finance qu'un bon. Rejouer l'émission ne double pas le carburant.
CREATE UNIQUE INDEX fuel_vouchers_un_bon_par_paiement ON fuel_vouchers (payment_id);

-- Un scan ne consomme qu'un bon. Rejouer un scan sur un autre bon est refusé en base.
CREATE UNIQUE INDEX fuel_vouchers_redemption_unique
  ON fuel_vouchers (redemption_id)
  WHERE redemption_id IS NOT NULL;

CREATE INDEX fuel_vouchers_par_chauffeur ON fuel_vouchers (driver_id, emis_a DESC);
CREATE INDEX fuel_vouchers_a_expirer ON fuel_vouchers (expire_a) WHERE statut = 'EMIS';

-- ---------------------------------------------------------------- envoi du QR

CREATE TABLE voucher_deliveries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id    UUID NOT NULL REFERENCES fuel_vouchers(id),
  canal         TEXT NOT NULL DEFAULT 'WHATSAPP',
  destinataire  TEXT NOT NULL,
  statut        TEXT NOT NULL CHECK (statut IN ('EN_ATTENTE', 'ENVOYE', 'ECHEC')),
  provider_ref  TEXT,
  erreur        TEXT,
  tentatives    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un chauffeur qui n'a pas reçu son QR a payé pour rien : l'échec doit être visible.
CREATE INDEX voucher_deliveries_en_echec ON voucher_deliveries (created_at)
  WHERE statut = 'ECHEC';

-- ---------------------------------------------------------------- rattachement TE

-- La consommation relevée sur la carte TotalEnergies est rapprochée du bon qui l'a autorisée.
-- Nullable : un mouvement carte sans bon existe (et doit se voir), un bon sans mouvement aussi.
ALTER TABLE card_transactions ADD COLUMN voucher_id UUID REFERENCES fuel_vouchers(id);

CREATE UNIQUE INDEX card_transactions_un_bon_par_mouvement
  ON card_transactions (voucher_id)
  WHERE voucher_id IS NOT NULL;

COMMIT;

-- ---------------------------------------------------------------------------
-- Note sur l'atomicité de la consommation
--
-- La consommation se fait par un UPDATE conditionnel, jamais par un SELECT suivi d'un UPDATE :
--
--   UPDATE fuel_vouchers
--      SET statut = 'CONSOMME', consomme_a = $1, station_id = $2,
--          operateur_id = $3, redemption_id = $4
--    WHERE id = $5 AND statut = 'EMIS' AND expire_a > $1;
--
-- Zéro ligne affectée signifie : déjà consommé, expiré, ou annulé. Il faut alors relire la ligne
-- pour distinguer les trois cas et répondre au pompiste. Deux pompistes qui scannent le même bon
-- au même instant : un seul UPDATE affecte une ligne.
-- ---------------------------------------------------------------------------
