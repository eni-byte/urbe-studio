#!/usr/bin/env node
/**
 * Crée automatiquement les 13 liens de paiement Stripe d'Urbe Studio.
 *
 * ⚠️ TA CLÉ SECRÈTE RESTE CHEZ TOI — elle n'est lue que depuis ton terminal.
 *
 * UTILISATION :
 *   1. Récupère ta clé secrète sur https://dashboard.stripe.com/apikeys
 *      (commence par sk_live_… pour la prod, ou sk_test_… pour tester d'abord)
 *   2. Dans un terminal, à la racine du projet :
 *
 *        STRIPE_SECRET_KEY=sk_test_xxx node scripts/create-stripe-payment-links.mjs
 *
 *   3. Le script affiche un bloc prêt à coller dans URBE_CONFIG.stripe (index.html).
 *      Colle-le-moi et je l'intègre + passe le site en mode 'live'.
 *
 * Nécessite Node 18+ (fetch intégré). Aucune dépendance à installer.
 */

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY || !/^sk_(test|live)_/.test(KEY)) {
  console.error('❌ Clé manquante ou invalide.\n   Lance :  STRIPE_SECRET_KEY=sk_test_xxx node scripts/create-stripe-payment-links.mjs');
  process.exit(1);
}
const MODE = KEY.startsWith('sk_live_') ? 'LIVE (réel)' : 'TEST';

// montants en centimes d'euro · perHour = quantité ajustable (nombre d'heures)
const PRODUCTS = [
  { key: 'session-avec',      name: 'Session studio · Avec ingénieur (par heure)', amount: 3000,   perHour: true },
  { key: 'session-sans',      name: 'Session studio · Sans ingénieur (par heure)', amount: 2000,   perHour: true },
  { key: 'session-nuit',      name: 'Session studio · Nuit après 21h (par heure)', amount: 3500,   perHour: true },
  { key: 'mix-standard',      name: 'Mix standard (1 titre)',                       amount: 12000 },
  { key: 'mix-urgent',        name: 'Mix urgent 48h (1 titre)',                     amount: 17000 },
  { key: 'mastering',         name: 'Mastering (1 titre)',                          amount: 5000 },
  { key: 'pack-rec-mix-mast', name: 'Pack Rec + Mix + Master',                      amount: 20000 },
  { key: 'pack-compo-full',   name: 'Pack Composition complète',                    amount: 30000 },
  { key: 'forfait-10h',       name: 'Forfait 10h de studio',                        amount: 27000 },
  { key: 'forfait-20h',       name: 'Forfait 20h de studio',                        amount: 51000 },
  { key: 'forfait-50h',       name: 'Forfait 50h de studio',                        amount: 125000 },
  { key: 'pack-com-1',        name: 'Pack Com · Shooting + 1 reel',                 amount: 25000 },
  { key: 'pack-com-3',        name: 'Pack Com · Shooting + 3 reels',                amount: 45000 },
];

async function stripe(path, params) {
  const res = await fetch('https://api.stripe.com/v1/' + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json.error && json.error.message) || JSON.stringify(json));
  return json;
}

const out = {};
console.log(`\n🔗 Création des liens de paiement Stripe — mode ${MODE}\n`);
for (const p of PRODUCTS) {
  try {
    const price = await stripe('prices', {
      currency: 'eur',
      unit_amount: String(p.amount),
      'product_data[name]': p.name,
    });
    const params = {
      'line_items[0][price]': price.id,
      'line_items[0][quantity]': '1',
    };
    if (p.perHour) {
      params['line_items[0][adjustable_quantity][enabled]'] = 'true';
      params['line_items[0][adjustable_quantity][minimum]'] = '1';
      params['line_items[0][adjustable_quantity][maximum]'] = '24';
    }
    const link = await stripe('payment_links', params);
    out[p.key] = link.url;
    console.log(`✓ ${p.key.padEnd(18)} ${(p.amount / 100).toFixed(2)}€  →  ${link.url}`);
  } catch (e) {
    console.error(`✗ ${p.key} : ${e.message}`);
  }
}

console.log('\n──────────────────────────────────────────────');
console.log('À COLLER dans URBE_CONFIG.stripe (index.html) :');
console.log('──────────────────────────────────────────────\n');
console.log('  stripe: {');
console.log(Object.entries(out).map(([k, v]) => `    '${k}': '${v}',`).join('\n'));
console.log('  },\n');
console.log('Puis colle simplement ce bloc dans le chat, je m\'occupe du reste. ✅');
