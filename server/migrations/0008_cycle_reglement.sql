-- 0008_cycle_reglement.sql
--
-- Trois manques du schéma initial, révélés en branchant le cycle de règlement sur une vraie
-- base. Le domaine les portait déjà ; la table ne savait pas les recevoir.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Une intention en préparation n'a pas encore de clé d'idempotence
--
-- La clé se tire au moment de l'envoi, une par tentative. Exiger NOT NULL dès la création
-- obligeait à poser une valeur bidon, qui occupait l'index unique sans rien protéger et se
-- confondait à la lecture avec une vraie clé.
--
-- L'index unique reste : PostgreSQL autorise plusieurs NULL dans un index unique, donc les
-- brouillons coexistent tout en gardant la garantie « une clé, une intention » dès qu'un ordre
-- part réellement.
-- ---------------------------------------------------------------------------

ALTER TABLE payment_intents ALTER COLUMN idempotency_key DROP NOT NULL;

-- Une intention qui a quitté la préparation porte forcément sa clé : c'est l'invariant §11.
ALTER TABLE payment_intents ADD CONSTRAINT pi_cle_des_lenvoi CHECK (
  statut IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED')
  OR idempotency_key IS NOT NULL
);

-- ---------------------------------------------------------------------------
-- 2. Le montant réellement réglé, et l'écart
--
-- Le domaine calcule `ecart = attendu - constaté` et bascule en VARIANCE dès qu'il est non nul.
-- Sans colonnes pour les recevoir, un écart disparaissait au premier redémarrage : l'intention
-- serait revenue VARIANCE sans qu'on sache de combien.
--
-- `ecart_xof` est le seul montant du schéma autorisé à être négatif — un trop-versé est un
-- écart, pas une impossibilité. La contrainte porte sur sa cohérence avec le montant réglé,
-- pas sur son signe.
-- ---------------------------------------------------------------------------

ALTER TABLE payment_intents ADD COLUMN montant_regle_xof BIGINT;
ALTER TABLE payment_intents ADD COLUMN ecart_xof         BIGINT;

ALTER TABLE payment_intents ADD CONSTRAINT pi_montant_regle_positif
  CHECK (montant_regle_xof IS NULL OR montant_regle_xof >= 0);

-- Les deux vont ensemble, et l'écart doit valoir ce qu'il prétend. Une ligne où l'écart ne
-- correspond pas au montant réglé serait un chiffre faux affiché au rapprochement.
ALTER TABLE payment_intents ADD CONSTRAINT pi_ecart_coherent CHECK (
  (montant_regle_xof IS NULL AND ecart_xof IS NULL)
  OR (montant_regle_xof IS NOT NULL AND ecart_xof = montant_xof - montant_regle_xof)
);

-- ---------------------------------------------------------------------------
-- 3. Retrouver les intentions d'un contrat, et le cumul du jour
--
-- Le plafond quotidien se calcule à chaque envoi : la requête doit rester bornée même quand la
-- table aura grossi.
-- ---------------------------------------------------------------------------

CREATE INDEX payment_intents_par_envoi ON payment_intents (ts_dispatching DESC)
  WHERE ts_dispatching IS NOT NULL;

COMMIT;
