/* ═══════════════════════════════════════════════════════════════════
   Proxy site → n8n.

   Avant : le navigateur appelait les webhooks n8n directement, avec la
   clé partagée écrite dans le JS livré au visiteur. N'importe qui pouvait
   la lire et créer de faux leads, ou déclencher l'envoi d'un email depuis
   le Gmail du studio vers l'adresse de son choix.

   Maintenant : le navigateur appelle /api/<action> sur notre propre
   domaine. La clé vit dans la variable d'environnement Netlify
   URBE_WEBHOOK_KEY et ne quitte jamais le serveur.
   ═══════════════════════════════════════════════════════════════════ */

import { getStore } from '@netlify/blobs';

const N8N_BASE = 'https://mpoi.app.n8n.cloud/webhook';


/* Seuls ces webhooks sont joignables depuis le site, chacun avec son
   budget d'appels par minute et par IP. Tout le reste est refusé. */
const ROUTES = {
  lead:    { path: 'urbe-lead-site',      max: 8  },
  chat:    { path: 'urbe-chat',           max: 20 },
  slots:   { path: 'urbe-slots',          max: 30 },
  booking: { path: 'urbe-booking',        max: 8  },
  session: { path: 'urbe-create-session', max: 8  },
};

const WINDOW_MS = 60_000;
const MAX_BODY = 16 * 1024;

function originAutorisee(origin) {
  if (!origin) return false;
  if (origin === 'https://www.urbestudio.fr') return true;
  if (origin === 'https://urbestudio.fr') return true;
  // Déploiements de prévisualisation Netlify
  return /^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin);
}

/* Compteur partagé entre toutes les instances de la fonction.
   Un compteur en mémoire ne marche pas ici : Netlify sert les requêtes
   concurrentes depuis plusieurs instances, chacune avec sa propre mémoire
   (constaté en production, le 33e appel passait encore). Netlify Blobs est
   le stockage partagé recommandé ; en consistance forte pour que deux
   requêtes simultanées ne lisent pas la même valeur périmée.

   Une entrée par couple (action, IP), réécrite à chaque fenêtre : le nombre
   de clés reste borné par le nombre d'IP vues, pas par le nombre d'appels. */
async function tropDAppels(cle, max) {
  try {
    const store = getStore({ name: 'urbe-debit', consistency: 'strong' });
    const fenetre = Math.floor(Date.now() / WINDOW_MS);
    const brut = await store.get(cle, { type: 'json' });
    const compte = brut && brut.fenetre === fenetre ? brut.compte : 0;
    if (compte >= max) return true;
    await store.setJSON(cle, { fenetre, compte: compte + 1 });
    return false;
  } catch (e) {
    // Un stockage indisponible ne doit jamais bloquer un vrai client.
    return false;
  }
}

/* Selon que Netlify route via config.path ou via la regle de reecriture du
   netlify.toml, l'URL vue ici est /api/lead ou /.netlify/functions/urbe/lead.
   On cherche donc simplement le premier segment qui est une action connue. */
function resoudreAction(req, context) {
  const candidat = context?.params?.action;
  if (candidat && Object.prototype.hasOwnProperty.call(ROUTES, candidat)) return candidat;
  const segments = new URL(req.url).pathname.split('/').filter(Boolean);
  for (const seg of segments) {
    if (Object.prototype.hasOwnProperty.call(ROUTES, seg)) return seg;
  }
  return null;
}

/* Netlify recommande Netlify.env, mais ce global n'existe que dans son
   runtime : sans ce repli sur process.env, la fonction est intestable hors
   ligne (elle levait une ReferenceError avalee en 502). */
function lireVariable(nom) {
  try {
    if (typeof Netlify !== 'undefined' && Netlify.env) return Netlify.env.get(nom);
  } catch (e) { /* ignore */ }
  return typeof process !== 'undefined' && process.env ? process.env[nom] : undefined;
}

const refus = (code, message) =>
  new Response(JSON.stringify({ error: message }), {
    status: code,
    headers: { 'Content-Type': 'application/json' },
  });

export default async (req, context) => {
  if (req.method !== 'POST') return refus(405, 'method_not_allowed');
  if (!originAutorisee(req.headers.get('origin'))) return refus(403, 'forbidden_origin');

  const action = resoudreAction(req, context);
  const route = action ? ROUTES[action] : null;
  if (!route) return refus(404, 'unknown_action');

  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'inconnue';
  if (await tropDAppels(action + '|' + ip, route.max)) return refus(429, 'too_many_requests');

  const body = await req.text();
  if (body.length > MAX_BODY) return refus(413, 'payload_too_large');

  /* Les webhooks n8n sont protégés par l'authentification Header Auth native,
     adossée à une credential chiffrée. La même valeur vit ici dans la variable
     Netlify. Sans elle, on refuse plutôt que d'envoyer une requête qui serait
     de toute façon rejetée. */
  const cle = lireVariable('URBE_WEBHOOK_KEY');
  if (!cle) return refus(500, 'missing_key');

  try {
    const amont = await fetch(`${N8N_BASE}/${route.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Urbe-Key': cle },
      body: body || '{}',
      signal: AbortSignal.timeout(20_000),
    });
    return new Response(await amont.text(), {
      status: amont.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    // On ne renvoie jamais le détail de l'erreur amont au navigateur.
    return refus(502, 'upstream_unavailable');
  }
};

/* Route officielle Netlify Functions v2. La regle /api/* du netlify.toml
   sert de filet si cette forme n'est pas prise en charge. */
export const config = { path: '/api/:action' };
