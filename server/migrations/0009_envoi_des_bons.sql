-- 0009_envoi_des_bons.sql
--
-- La file d'envoi des QR était en écriture seule : `PgVoucherDeliveryQueue` savait empiler,
-- rien ne savait dépiler. Le chauffeur payait et ne recevait jamais son bon. Brancher un worker
-- demande un état de plus, et deux index.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. L'état « réclamé, pas encore parti »
--
-- Sans lui, un envoi en cours est indiscernable d'un envoi en attente : deux workers
-- expédieraient le même bon, et le chauffeur recevrait deux fois le même code — au mieux
-- déroutant, au pire pris pour deux bons.
--
-- Il porte aussi la reprise après crash : une ligne restée dans cet état signale un worker mort
-- en plein envoi. Le compteur de tentatives ayant déjà avancé au moment de la réclamation, elle
-- ne peut pas boucler indéfiniment.
-- ---------------------------------------------------------------------------

ALTER TABLE voucher_deliveries DROP CONSTRAINT voucher_deliveries_statut_check;
ALTER TABLE voucher_deliveries ADD CONSTRAINT voucher_deliveries_statut_check
  CHECK (statut IN ('EN_ATTENTE', 'ENVOI_EN_COURS', 'ENVOYE', 'ECHEC'));

-- Un envoi abouti porte la trace de qui l'a acheminé ; un échec porte sa raison.
ALTER TABLE voucher_deliveries ADD CONSTRAINT voucher_deliveries_echec_motive
  CHECK (statut <> 'ECHEC' OR erreur IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 2. La requête du worker
--
-- Elle tourne à chaque passage et cherche les plus anciennes lignes en attente. Sans index,
-- elle balaierait toute la table — qui grossit d'une ligne par bon émis, donc indéfiniment.
-- ---------------------------------------------------------------------------

CREATE INDEX voucher_deliveries_a_envoyer
  ON voucher_deliveries (created_at)
  WHERE statut = 'EN_ATTENTE';

-- Retrouver les envois d'un bon : sert au diagnostic quand un chauffeur dit n'avoir rien reçu.
CREATE INDEX voucher_deliveries_par_bon ON voucher_deliveries (voucher_id);

COMMIT;
