/**
 * Page de démonstration. Servie uniquement par `demo-server.ts`.
 *
 * Elle appelle les vraies routes de l'API avec les vrais jetons — rien n'est mimé côté client.
 */

export function pageDemo(): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Assur'Trans — démonstration du bon carburant</title>
<style>
  :root {
    --fond: #f4f6f5; --carte: #fff; --bord: #d8e0dd; --texte: #17211e;
    --doux: #5d6f69; --accent: #2f6f5e; --ok: #1e7a4d; --ko: #b23c2e; --alerte: #9a6b12;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--fond); color: var(--texte);
         font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  header { background: var(--accent); color: #fff; padding: 20px 24px; }
  header h1 { margin: 0 0 4px; font-size: 19px; }
  header p { margin: 0; opacity: .85; font-size: 13px; }
  .avertissement { background: #fff6e0; border-bottom: 1px solid #e8d5a3; color: #6b4e11;
                   padding: 10px 24px; font-size: 13px; }
  main { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
         gap: 16px; padding: 20px 24px 40px; max-width: 1100px; margin: 0 auto; align-items: start; }
  section { background: var(--carte); border: 1px solid var(--bord); border-radius: 10px; padding: 18px; }
  h2 { margin: 0 0 4px; font-size: 15px; }
  .sous { margin: 0 0 14px; color: var(--doux); font-size: 13px; }
  label { display: block; font-size: 13px; color: var(--doux); margin: 12px 0 4px; }
  input, textarea { width: 100%; padding: 9px 10px; border: 1px solid var(--bord);
                    border-radius: 7px; font: inherit; background: #fff; color: inherit; }
  textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; resize: vertical; }
  button { margin: 10px 6px 0 0; padding: 9px 14px; border: 0; border-radius: 7px;
           background: var(--accent); color: #fff; font: inherit; cursor: pointer; }
  button.secondaire { background: #e7edea; color: var(--texte); }
  button:disabled { opacity: .45; cursor: not-allowed; }
  .etape { border-left: 3px solid var(--bord); padding-left: 12px; margin-top: 16px; }
  .etape.faite { border-left-color: var(--ok); }
  pre { background: #10201b; color: #d7ece3; padding: 12px; border-radius: 7px;
        overflow-x: auto; font-size: 12px; margin: 10px 0 0; }
  .verdict { margin-top: 12px; padding: 12px 14px; border-radius: 8px; font-weight: 600; }
  .verdict.ok { background: #e4f4ea; color: var(--ok); }
  .verdict.ko { background: #fbe9e6; color: var(--ko); }
  .verdict.alerte { background: #fdf3dd; color: var(--alerte); }
  img.qr { display: block; margin: 12px 0 0; border: 1px solid var(--bord); border-radius: 8px; }
  code { background: #eef2f0; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
  .muet { color: var(--doux); font-size: 12px; margin-top: 6px; }
</style>
</head>
<body>
<header>
  <h1>Assur'Trans — bon carburant à usage unique</h1>
  <p>Le chauffeur paie, reçoit un QR, le pompiste le consomme.</p>
</header>

<div class="avertissement">
  <strong>Harnais de démonstration.</strong> Les routes, la machine à états du bon, la signature
  du QR et les contrôles d'accès sont le code de production. Le stockage est en mémoire et le
  prestataire de paiement est simulé — tout disparaît à l'arrêt du serveur.
</div>

<main>
  <section>
    <h2>Côté chauffeur</h2>
    <p class="sous">Moussa Ndiaye · +221 77 000 00 01</p>

    <div class="etape" id="e1">
      <strong>1. Demander un bon</strong>
      <label for="montant">Montant en francs CFA (entier, entre 1 000 et 200 000)</label>
      <input id="montant" type="number" value="20000" step="1" min="1000" max="200000">
      <button id="ouvrir">Ouvrir le paiement</button>
      <div class="muet">Le montant est figé ici. Il n'y a pas de solde, pas de reliquat.</div>
    </div>

    <div class="etape" id="e2">
      <strong>2. Payer</strong>
      <div class="muet">Le chauffeur serait renvoyé vers Wave. Ce bouton fabrique et signe
      l'événement de confirmation à sa place — seul raccourci de la démonstration.</div>
      <button id="payer" class="secondaire" disabled>Simuler le paiement</button>
    </div>

    <div class="etape" id="e3">
      <strong>3. Recevoir le QR</strong>
      <div class="muet">En production, ce QR part sur WhatsApp au numéro du chauffeur.</div>
      <div id="qr"></div>
    </div>

    <pre id="journalChauffeur">en attente…</pre>
  </section>

  <section>
    <h2>Côté pompiste</h2>
    <p class="sous">Station Dakar 3 · opérateur pompiste-demo</p>

    <label for="jeton">QR scanné</label>
    <textarea id="jeton" rows="4" placeholder="contenu du QR"></textarea>
    <button id="coller" class="secondaire">Scanner le QR du chauffeur</button>

    <div class="etape">
      <strong>Servir</strong>
      <button id="servir">Vérifier et servir</button>
      <button id="rescanner" class="secondaire">Rescanner (réseau coupé)</button>
      <button id="autrePompiste" class="secondaire">Autre pompiste, même QR</button>
      <div class="muet">Les deux derniers boutons se ressemblent et n'ont rien à voir : le
      premier rejoue le même scan, le second est une seconde présentation.</div>
    </div>

    <div id="verdict"></div>
    <pre id="journalPompiste">en attente…</pre>
  </section>

  <section>
    <h2>État du système</h2>
    <p class="sous">Ce que contient la mémoire à l'instant présent.</p>
    <button id="rafraichir" class="secondaire">Rafraîchir</button>
    <pre id="etat">—</pre>
  </section>
</main>

<script>
const $ = (id) => document.getElementById(id);
let config = null;
let reference = null;
let montantCourant = null;
let scanCourant = null;

const ecrire = (cible, valeur) => { $(cible).textContent =
  typeof valeur === 'string' ? valeur : JSON.stringify(valeur, null, 2); };

function verdict(classe, texte) {
  $('verdict').innerHTML = '<div class="verdict ' + classe + '">' + texte + '</div>';
}

async function appel(url, options = {}) {
  const reponse = await fetch(url, options);
  let corps;
  try { corps = await reponse.json(); } catch { corps = { erreur: 'reponse illisible' }; }
  return { statut: reponse.status, corps };
}

async function chargerConfig() {
  config = (await appel('/demo/config')).corps;
}

$('ouvrir').onclick = async () => {
  const montantXof = Number($('montant').value);
  const r = await appel('/api/paiements/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json',
               authorization: 'Bearer ' + config.jetonChauffeur },
    body: JSON.stringify({ montantXof }),
  });
  ecrire('journalChauffeur', { requete: 'POST /api/paiements/session', ...r });
  if (r.statut === 201) {
    reference = r.corps.reference;
    montantCourant = r.corps.montantXof;
    $('e1').classList.add('faite');
    $('payer').disabled = false;
  }
};

$('payer').onclick = async () => {
  const r = await appel('/demo/simuler-paiement', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reference, montantXof: montantCourant }),
  });
  ecrire('journalChauffeur', { requete: 'webhook signé -> POST /webhooks/wave', ...r });
  if (r.statut === 200) {
    $('e2').classList.add('faite');
    const qr = await appel('/demo/dernier-qr');
    if (qr.statut === 200) {
      $('e3').classList.add('faite');
      $('qr').innerHTML =
        '<img class="qr" src="' + qr.corps.image + '" alt="QR du bon carburant">' +
        '<div class="muet">envoyé à ' + qr.corps.destinataire + ' · ' +
        qr.corps.montantXof + ' XOF · expire le ' +
        new Date(qr.corps.expireA).toLocaleString('fr-FR') + '</div>';
      $('jeton').dataset.dernier = qr.corps.jeton;
    }
  }
  rafraichirEtat();
};

$('coller').onclick = () => {
  const jeton = $('jeton').dataset.dernier;
  if (!jeton) { verdict('alerte', 'Aucun bon émis pour le moment.'); return; }
  $('jeton').value = jeton;
  scanCourant = 'scan-' + Date.now();
  verdict('alerte', 'QR chargé. Prêt à servir.');
};

async function consommer(redemptionId) {
  const r = await appel('/api/station/consommation', {
    method: 'POST',
    headers: { 'content-type': 'application/json',
               authorization: 'Bearer ' + config.jetonPompiste },
    body: JSON.stringify({ token: $('jeton').value.trim(), redemptionId,
                           stationId: 'station-999' }),
  });
  ecrire('journalPompiste', { requete: 'POST /api/station/consommation',
                              redemptionId, ...r });

  if (r.statut === 200 && !r.corps.dejaServi) {
    verdict('ok', 'SERVIR ' + r.corps.montantXof + ' XOF');
  } else if (r.statut === 200 && r.corps.dejaServi) {
    verdict('alerte', 'Même scan rejoué. Déjà servi, ne pas resservir.');
  } else {
    verdict('ko', 'NE PAS SERVIR — ' + (r.corps.erreur || 'refus'));
  }
  rafraichirEtat();
}

$('servir').onclick = () => {
  if (!scanCourant) scanCourant = 'scan-' + Date.now();
  consommer(scanCourant);
};
$('rescanner').onclick = () => consommer(scanCourant || 'scan-inconnu');
$('autrePompiste').onclick = () => consommer('scan-autre-' + Date.now());

async function rafraichirEtat() {
  ecrire('etat', (await appel('/demo/etat')).corps);
}
$('rafraichir').onclick = rafraichirEtat;

chargerConfig().then(rafraichirEtat);
</script>
</body>
</html>`;
}
