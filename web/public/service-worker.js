/*
 * Service worker.
 *
 * Objectif unique : un chauffeur dont le réseau tombe à la pompe doit quand même voir son QR.
 *
 * La difficulté n'est pas l'absence de réseau — le navigateur échoue vite et proprement — mais
 * le réseau *qui traîne* : 2G saturée, portail captif, perte de paquets. Là, `fetch()` peut
 * rester en attente une minute avant de rendre la main. Une stratégie « réseau d'abord » laisse
 * alors le chauffeur devant une page blanche, pistolet à la main.
 *
 * D'où le choix inverse :
 *   - les fichiers versionnés (`/assets/…`) sont servis depuis le cache SANS toucher au réseau.
 *     Leur nom contient une empreinte de leur contenu : ils ne changent jamais, donc les
 *     revalider n'a aucun intérêt ;
 *   - les navigations servent l'`index.html` en cache immédiatement, et rafraîchissent en
 *     arrière-plan pour la fois suivante ;
 *   - l'API n'est jamais mise en cache. Un bon consommé ailleurs ne doit pas revenir d'un cache
 *     HTTP. Ce que le chauffeur voit hors ligne vient d'un enregistrement explicite côté
 *     application, qu'on maîtrise et qu'on peut effacer à la déconnexion.
 */

const VERSION = 'v2';
const CACHE = `assurtrans-${VERSION}`;

/* Le strict nécessaire pour démarrer. Les fichiers versionnés s'ajoutent à la première visite. */
const SOCLE = ['/', '/index.html', '/manifest.webmanifest', '/icone.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SOCLE))
      // Une ressource manquante ne doit pas empêcher l'installation : mieux vaut un cache
      // partiel qu'aucun service worker.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) =>
        Promise.all(cles.filter((cle) => cle !== CACHE).map((cle) => caches.delete(cle))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Fichier versionné : son nom porte une empreinte, son contenu ne changera jamais. */
function estVersionne(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname === '/icone.svg'
  );
}

async function mettreEnCache(requete, reponse) {
  // On ne garde que des réponses complètes et exploitables.
  if (!reponse || reponse.status !== 200 || reponse.type === 'opaque') return;
  const cache = await caches.open(CACHE);
  await cache.put(requete, reponse.clone());
}

/** Cache d'abord, réseau seulement si le fichier manque. */
async function cacheDAbord(requete) {
  const enCache = await caches.match(requete);
  if (enCache !== undefined) return enCache;

  const reponse = await fetch(requete);
  await mettreEnCache(requete, reponse);
  return reponse;
}

/**
 * Navigation : on rend la page en cache tout de suite, et on rafraîchit en arrière-plan.
 *
 * Les fichiers étant versionnés, un `index.html` ancien continue de pointer vers des fichiers
 * eux aussi en cache : l'application reste cohérente, simplement d'une version de retard. La
 * mise à jour prend effet au lancement suivant.
 */
async function pageDAbord(requete) {
  const cache = await caches.open(CACHE);
  const enCache = (await cache.match('/index.html')) ?? (await cache.match('/'));

  const rafraichir = fetch(requete)
    .then(async (reponse) => {
      await mettreEnCache('/index.html', reponse);
      return reponse;
    })
    .catch(() => undefined);

  if (enCache !== undefined) {
    void rafraichir;
    return enCache;
  }

  const reseau = await rafraichir;
  if (reseau !== undefined) return reseau;

  return new Response(
    '<!doctype html><html lang="fr"><meta charset="utf-8">' +
      '<title>Hors connexion</title>' +
      '<body style="font:16px system-ui;padding:32px;color:#0f2620;background:#e9ecea">' +
      '<h1 style="font-size:22px">Application indisponible hors connexion</h1>' +
      '<p>Ouvrez l’application une fois avec du réseau : elle fonctionnera ensuite sans.</p>',
    { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

self.addEventListener('fetch', (event) => {
  const requete = event.request;
  if (requete.method !== 'GET') return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  // L'API n'est jamais servie depuis un cache : le statut d'un bon ne se devine pas.
  if (url.pathname.startsWith('/api/')) return;

  if (requete.mode === 'navigate') {
    event.respondWith(pageDAbord(requete));
    return;
  }

  if (estVersionne(url)) {
    event.respondWith(cacheDAbord(requete));
    return;
  }

  event.respondWith(
    fetch(requete)
      .then(async (reponse) => {
        await mettreEnCache(requete, reponse);
        return reponse;
      })
      .catch(async () => (await caches.match(requete)) ?? Response.error()),
  );
});
