/* ─── Génération statique du <head> SEO par route (post-build) ───────────────
   Après `vite build`, on part de dist/index.html (le shell de l'app) et, pour
   chaque route, on réécrit title / description / canonical / OG / robots / JSON-LD,
   puis on écrit dist/<route>/index.html. Netlify sert ces fichiers réels en
   priorité (avant le fallback SPA) → Google et les robots sociaux (qui ne lisent
   PAS le JS) obtiennent le bon <head>. Le corps reste rendu par React côté client.

   NON BLOQUANT : toute erreur est loggée mais n'échoue pas le build (le fallback
   SPA sert alors index.html — le site reste fonctionnel). */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ROUTES, SITE, OG_IMAGE } from '../src/seo-data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, '..', 'dist');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function replaceMeta(html, attr, key, val) {
  const re = new RegExp(`<meta ${attr}="${key}"[^>]*>`);
  const tag = `<meta ${attr}="${key}" content="${esc(val)}" />`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `${tag}\n</head>`);
}

function buildHtml(tpl, seo) {
  const canonical = SITE + seo.path;
  let html = tpl;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(seo.title)}</title>`);
  html = replaceMeta(html, 'name', 'description', seo.description);
  html = replaceMeta(html, 'name', 'robots', seo.noindex ? 'noindex, nofollow' : 'index, follow');
  html = replaceMeta(html, 'property', 'og:title', seo.title);
  html = replaceMeta(html, 'property', 'og:description', seo.description);
  html = replaceMeta(html, 'property', 'og:url', canonical);
  html = replaceMeta(html, 'property', 'og:image', OG_IMAGE);
  html = replaceMeta(html, 'name', 'twitter:title', seo.title);
  html = replaceMeta(html, 'name', 'twitter:description', seo.description);
  const linkRe = /<link rel="canonical"[^>]*>/;
  const linkTag = `<link rel="canonical" href="${canonical}" />`;
  html = linkRe.test(html) ? html.replace(linkRe, linkTag) : html.replace('</head>', `${linkTag}\n</head>`);
  // JSON-LD : la 1re balise ld+json reçoit les schémas de la route, les autres sont supprimées
  const jsonld = (seo.jsonLd || []).map((o) => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n</script>`).join('\n');
  let first = true;
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, () => {
    if (first) { first = false; return jsonld; }
    return '';
  });
  if (first && jsonld) html = html.replace('</head>', `${jsonld}\n</head>`);
  return html;
}

try {
  const tpl = readFileSync(join(dist, 'index.html'), 'utf8');
  let n = 0;
  for (const seo of Object.values(ROUTES)) {
    // Fichier PLAT (dist/studio.html) et non un dossier : Netlify sert alors
    // /studio SANS trailing slash ni redirection 301 -> cohabite avec les
    // canonicals (sans slash). /studio/ est redirige vers /studio par Netlify.
    const outFile = join(dist, seo.path.replace(/^\//, '') + '.html');
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, buildHtml(tpl, seo));
    n++;
  }
  // Page 404 (statut géré côté Netlify en Phase 4)
  writeFileSync(join(dist, '404.html'), buildHtml(tpl, {
    path: '/404', title: 'Page introuvable | URBE STUDIO',
    description: "Cette page n'existe pas ou plus. Revenez à l'accueil du studio URBE, Paris 10.",
    noindex: true, jsonLd: [],
  }));
  console.log(`[gen-pages] ${n} pages SEO générées + 404.html`);
} catch (e) {
  console.warn('[gen-pages] échec (non bloquant, le fallback SPA prend le relais):', e.message);
}
process.exit(0);
