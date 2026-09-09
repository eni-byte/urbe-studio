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

const N8N_BASE = 'https://mpoi.app.n8n.cloud/webhook';

/* Repli sur l'ancienne clé tant que la variable Netlify n'est pas posée :
   le site continue de fonctionner pendant la bascule. Cette valeur est
   déjà publique (elle était dans le bundle) — elle doit être remplacée
   par une nouvelle clé côté propriétaire, puis ce repli supprimé. */
const FALLBACK_KEY = 'urbe_web_9Kx7mQp2Lr4Tv';

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

/* Compteur glissant en mémoire. Netlify réutilise l'instance quelques
   minutes : ça coupe le martèlement depuis une même IP. Ce n'est pas une
   garantie absolue (plusieurs instances peuvent coexister), c'est une
   barrière de coût pour l'attaquant. */
const hits = new Map();
function tropDAppels(cle, max) {
  const now = Date.now();
  const recents = (hits.get(cle) || []).filter((t) => now - t < WINDOW_MS);
  recents.push(now);
  hits.set(cle, recents);
  if (hits.size > 5000) hits.clear();
  return recents.length > max;
}

const refus = (code, message) =>
  new Response(JSON.stringify({ error: message }), {
    status: code,
    headers: { 'Content-Type': 'application/json' },
  });

export default async (req, context) => {
  if (req.method !== 'POST') return refus(405, 'method_not_allowed');
  if (!originAutorisee(req.headers.get('origin'))) return refus(403, 'forbidden_origin');

  const action = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  const route = Object.prototype.hasOwnProperty.call(ROUTES, action) ? ROUTES[action] : null;
  if (!route) return refus(404, 'unknown_action');

  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'inconnue';
  if (tropDAppels(action + '|' + ip, route.max)) return refus(429, 'too_many_requests');

  const body = await req.text();
  if (body.length > MAX_BODY) return refus(413, 'payload_too_large');

  try {
    const amont = await fetch(`${N8N_BASE}/${route.path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Urbe-Key': process.env.URBE_WEBHOOK_KEY || FALLBACK_KEY,
      },
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
