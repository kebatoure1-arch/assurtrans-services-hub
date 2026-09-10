/**
 * Normalisation des numéros, pour les scripts.
 *
 * Le domaine porte la même logique dans `src/domain/otp.ts`. Elle est reproduite ici — et non
 * importée — parce que ces scripts tournent avant toute compilation : amorcer une base neuve
 * ne peut pas dépendre d'un `dist/` qui n'existe pas encore.
 *
 * Cette duplication est dangereuse et le test `test/msisdn.spec.ts` la garde honnête : il
 * confronte les deux implémentations sur la même batterie de saisies. Un administrateur amorcé
 * sous une forme et reconnu sous une autre ne pourrait tout simplement plus se connecter.
 *
 * Sénégal : 9 chiffres, mobiles 70/75/76/77/78. Côte d'Ivoire : 10 chiffres depuis 2021,
 * mobiles 01/05/07. Les fixes sont refusés — ils ne recevraient jamais de code.
 */

const PLANS = [
  { indicatif: '221', longueur: 9, mobiles: ['70', '75', '76', '77', '78'] },
  { indicatif: '225', longueur: 10, mobiles: ['01', '05', '07'] },
];

/** Rend le numéro en E.164, ou `null` si aucun plan desservi ne le reconnaît. */
export function normaliserMsisdn(saisie) {
  let chiffres = String(saisie).replace(/[\s.\-()]/g, '');
  if (chiffres.startsWith('+')) chiffres = chiffres.slice(1);
  else if (chiffres.startsWith('00')) chiffres = chiffres.slice(2);
  if (!/^[0-9]+$/.test(chiffres)) return null;

  const estMobile = (plan, national) =>
    national.length === plan.longueur && plan.mobiles.some((m) => national.startsWith(m));

  for (const plan of PLANS) {
    if (chiffres.startsWith(plan.indicatif)) {
      const national = chiffres.slice(plan.indicatif.length);
      if (estMobile(plan, national)) return `+${plan.indicatif}${national}`;
    }
  }
  for (const plan of PLANS) {
    if (estMobile(plan, chiffres)) return `+${plan.indicatif}${chiffres}`;
  }
  return null;
}

export const ATTENDU =
  'un mobile sénégalais (9 chiffres, 70/75/76/77/78) ou ivoirien (10 chiffres, 01/05/07)';
