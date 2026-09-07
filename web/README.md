# Front Assur'Trans

Interface du bon carburant. **Aucune dependance a Devv** : ni SDK, ni authentification tierce,
ni tables distantes. Le front ne parle qu'a l'API `server/`.

```bash
npm install
npm run dev      # http://localhost:5174
npm run build
```

```bash
npm test         # 64 tests d'interface
```

L'adresse de l'API se regle par `ASSURTRANS_API` (defaut `http://localhost:3001`). C'est la
seule variable, et c'est une information publique : aucun secret n'entre dans le bundle. Vite la
lit aussi bien depuis `web/.env.local` que depuis l'environnement du processus — une variable
exportee dans le terminal l'emporte donc sur le fichier.

## Un ecran par situation

| Ecran | Qui | La seule question a laquelle il repond |
|---|---|---|
| Connexion | tout le monde | quel est votre numero ? |
| Chauffeur | `DRIVER` | ai-je un bon a presenter ? |
| Pompiste | `STATION_OPERATOR` | est-ce que je sers, et combien ? |
| Pilotage | `ADMIN` | ou en est l'encours TotalEnergies ? |
| Referentiel | `ADMIN` | qui sont les chauffeurs, stations et operateurs ? |

Le role decide de l'ecran : un chauffeur ne voit jamais celui du pompiste. Seul
l'administrateur a une navigation, parce que lui seul a plusieurs choses a faire.

## Ce qui a guide le dessin

L'application est utilisee dehors, a une main, souvent en plein soleil, par des gens au travail
et presses. Ce n'est pas un tableau de bord qu'on consulte assis. D'ou :

- **Le bon est un ticket.** Talon avec le montant, perforation, QR — l'objet papier qu'il
  remplace. Le chauffeur reconnait la forme avant de lire quoi que ce soit.
- **Le verdict prend tout l'ecran.** Vert plein « SERVIR 20 000 », rouge plein « NE PAS SERVIR »
  avec le motif. Lisible a un metre. Il ne s'efface pas tout seul : c'est le pompiste qui le
  referme quand il a servi.
- **Semantique feu tricolore assumee**, parce que l'ecran du pompiste *est* un feu.
- **Surfaces tactiles jamais sous 56 px**, focus clavier toujours visible, animations coupees
  si le systeme le demande.
- **Montants en chiffres tabulaires**, largeur de police poussee : ils s'alignent d'une ligne a
  l'autre et ne dansent pas.

Polices auto-hebergees (Archivo, Public Sans) : rien a telecharger depuis un CDN sur un reseau
dakarois.

## Ce que le front ne fait pas

- **Il ne decide jamais si un bon est valable.** Seul le serveur sait si un bon a deja servi.
  Sans reseau, le pompiste lit « ne pas servir » plutot qu'un feu vert qui ne voudrait rien dire.
- **Il ne detient aucun secret.** Le jeton de session est obtenu par l'utilisateur avec son
  propre numero et expire de lui-meme. Les cles de signature restent cote serveur.
- **Il ne formule pas les refus a partir des messages du serveur.** Le serveur renvoie un code
  stable (`DEJA_SERVI`, `BON_EXPIRE`…) ; c'est `Pompiste.tsx` qui decide ce que le pompiste lit.
  Un identifiant de bon et un horodatage ISO n'ont rien a faire devant quelqu'un qui tient un
  pistolet a carburant.

## Limites assumées

- Le service worker conserve le shell et le dernier bon utilisable du chauffeur. Il ne met pas en
  file les paiements et ne permet pas au pompiste de valider hors ligne.
- L'administration couvre le referentiel et le pilotage de l'encours. Le cycle de reglement
  TotalEnergies — facture, intention, double approbation, execution — n'a pas encore d'ecran, ni
  le rapprochement, ni la consultation du journal d'audit.
- Les codes OTP passent par Africa's Talking côté serveur. Les secrets ne doivent jamais entrer
  dans le bundle frontend.
