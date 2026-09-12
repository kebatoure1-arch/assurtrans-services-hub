-- Le canal d'envoi disait WhatsApp pour des SMS.
--
-- `voucher_deliveries.canal` était écrit une fois, en dur, à la mise en file : 'WHATSAPP',
-- doublé par un DEFAULT de la migration 0002. Aucune écriture ne le corrigeait ensuite. Or
-- WhatsApp Business n'a jamais été câblé — il reste bloqué sur des identifiants Meta — et
-- l'expéditeur réel est `ExpediteurSms`, ou `ExpediteurJournal` en développement. Toute ligne
-- de cette table annonçait donc un canal par lequel rien n'est jamais parti, pendant que le
-- journal d'audit, lui, enregistrait le bon (`BON_ENVOYE`, champ `canal`).
--
-- Désormais la mise en file écrit 'INDETERMINE' — elle ignore quel expéditeur sera configuré
-- quand la ligne sera réclamée — et le worker inscrit le canal réel en marquant l'envoi, qu'il
-- ait réussi ou échoué.

ALTER TABLE voucher_deliveries ALTER COLUMN canal SET DEFAULT 'INDETERMINE';

-- Les lignes antérieures ne sont pas rattrapables : le canal réel de chacune n'est écrit nulle
-- part de façon exploitable, le journal d'audit ne conservant que l'empreinte du payload. Elles
-- passent donc à 'INDETERMINE' — un inconnu déclaré plutôt qu'une valeur fausse. Aucune
-- information n'est perdue : 'WHATSAPP' n'en portait aucune.
UPDATE voucher_deliveries SET canal = 'INDETERMINE' WHERE canal = 'WHATSAPP';
