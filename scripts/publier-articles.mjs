#!/usr/bin/env node
/* Publication echelonnee des articles du blog.
 *
 * Les 13 articles livres se citent mutuellement (graphe cyclique) : publies un par un,
 * certains liens internes pointeraient vers des pages pas encore en ligne (404).
 * Ce script gere ca automatiquement :
 *   - copie les articles demandes depuis content/blog-planifie/ vers public/blog/
 *   - date le jour de la publication (corps + JSON-LD)
 *   - neutralise, dans TOUTES les pages publiees, les liens vers un article pas encore
 *     en ligne (le texte reste, le lien disparait)
 *   - reactive automatiquement ces liens des que la cible est publiee
 *
 * Usage :
 *   node scripts/publier-articles.mjs                      # rafraichit les liens uniquement
 *   node scripts/publier-articles.mjs slug-a slug-b        # publie ces articles + rafraichit
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';

const PLANIFIE = 'content/blog-planifie';
const PUBLIE = 'public/blog';

const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const today = new Date();
const iso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
const humain = `${today.getDate()} ${MOIS[today.getMonth()]} ${today.getFullYear()}`;

const aPublier = process.argv.slice(2).map(s => s.replace(/\.html$/, ''));

// 1. Publication : copie + datage du jour
for (const slug of aPublier) {
  const src = join(PLANIFIE, `${slug}.html`);
  if (!existsSync(src)) { console.error(`  introuvable : ${slug}`); continue; }
  let h = readFileSync(src, 'utf8');
  h = h.replace(/"datePublished": "\d{4}-\d{2}-\d{2}"/, `"datePublished": "${iso}"`)
       .replace(/"dateModified": "\d{4}-\d{2}-\d{2}"/, `"dateModified": "${iso}"`)
       .replace(/(class="meta">)\d{1,2} \p{L}+ \d{4}/u, `$1${humain}`);
  writeFileSync(src, h);              // garde la source alignee
  copyFileSync(src, join(PUBLIE, `${slug}.html`));
  console.log(`  publié : ${slug} (${humain})`);
}

// 2. Etat des lieux : qui est en ligne, qui ne l'est pas
const tousLesSlugs = readdirSync(PLANIFIE).filter(f => f.endsWith('.html')).map(f => f.replace(/\.html$/, ''));
const enLigne = new Set(tousLesSlugs.filter(s => existsSync(join(PUBLIE, `${s}.html`))));
const horsLigne = tousLesSlugs.filter(s => !enLigne.has(s));

// 3. Liens : neutraliser vers hors-ligne, restaurer vers en-ligne
let neutralises = 0, restaures = 0;
for (const slug of enLigne) {
  const p = join(PUBLIE, `${slug}.html`);
  let h = readFileSync(p, 'utf8');
  const avant = h;

  // Neutralise : <a href="...cible.html">texte</a> -> <span data-lien-differe="cible">texte</span>
  for (const cible of horsLigne) {
    const re = new RegExp(`<a href="https://www\\.urbestudio\\.fr/blog/${cible}\\.html"([^>]*)>([\\s\\S]*?)</a>`, 'g');
    h = h.replace(re, (_m, _attrs, texte) => { neutralises++; return `<span data-lien-differe="${cible}">${texte}</span>`; });
  }

  // Restaure : <span data-lien-differe="cible">texte</span> -> <a href=...> des que la cible est en ligne
  h = h.replace(/<span data-lien-differe="([a-z0-9-]+)">([\s\S]*?)<\/span>/g, (m, cible, texte) => {
    if (!enLigne.has(cible)) return m;
    restaures++;
    return `<a href="https://www.urbestudio.fr/blog/${cible}.html">${texte}</a>`;
  });

  if (h !== avant) writeFileSync(p, h);
}

console.log(`\n  en ligne : ${enLigne.size}/${tousLesSlugs.length}`);
console.log(`  liens neutralisés (cible pas encore publiée) : ${neutralises}`);
console.log(`  liens réactivés (cible désormais publiée)    : ${restaures}`);
if (horsLigne.length) console.log(`  reste à publier : ${horsLigne.join(', ')}`);
