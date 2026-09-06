-- 0005_corrections_schema.sql
--
-- Deux incohérences entre le schéma et le code, relevées en préparant les tests d'intégration.
-- Elles ne se voyaient pas : les repositories étaient testés contre une doublure qui vérifie la
-- forme du SQL, pas son exécution. C'est exactement ce que les tests d'intégration doivent
-- attraper.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. fuel_vouchers.payment_ref
--
-- `PgVoucherRepository` écrit et relit `payment_ref` ; la colonne n'existait pas. Toute
-- émission de bon aurait échoué au premier contact avec une vraie base.
--
-- La colonne porte la référence lisible du paiement (« WAVE_CHECKOUT/cos-1 »), distincte de
-- `payment_id` qui est la clé étrangère. Elle sert au rapprochement et aux traces.
-- ---------------------------------------------------------------------------

ALTER TABLE fuel_vouchers ADD COLUMN payment_ref TEXT NOT NULL DEFAULT '';
ALTER TABLE fuel_vouchers ALTER COLUMN payment_ref DROP DEFAULT;
ALTER TABLE fuel_vouchers ADD CONSTRAINT fuel_vouchers_payment_ref_non_vide
  CHECK (payment_ref <> '');

-- ---------------------------------------------------------------------------
-- 2. Tolérance de rapprochement
--
-- Le domaine classe `MATCHED` un écart inférieur ou égal à une tolérance paramétrable
-- (`reconcile({ toleranceXof })`). La contrainte posée en 0001 exigeait un écart strictement
-- nul pour un `MATCHED` : une tolérance non nulle aurait fait échouer l'écriture.
--
-- Plutôt que de supprimer la contrainte, on enregistre la tolérance appliquée et on vérifie la
-- cohérence par rapport à elle. L'intention initiale — aucun `MATCHED` silencieux — est
-- conservée : un écart classé conforme reste visible, et il reste borné par une valeur écrite
-- en base plutôt que par une décision perdue dans la configuration du jour.
-- ---------------------------------------------------------------------------

ALTER TABLE reconciliations ADD COLUMN tolerance_xof BIGINT NOT NULL DEFAULT 0;
ALTER TABLE reconciliations ADD CONSTRAINT reconciliations_tolerance_positive
  CHECK (tolerance_xof >= 0);

ALTER TABLE reconciliations DROP CONSTRAINT reconciliations_matched_sans_ecart;
ALTER TABLE reconciliations ADD CONSTRAINT reconciliations_matched_dans_la_tolerance
  CHECK (statut <> 'MATCHED' OR abs(ecart_xof) <= tolerance_xof);

COMMIT;
