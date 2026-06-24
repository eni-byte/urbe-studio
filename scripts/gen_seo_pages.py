#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Génère les pages SEO statiques (pilier + cluster urbain + page locale) d'Urbe Studio.
Réutilise STRICTEMENT le design system des blogs existants (mêmes couleurs/typo/classes).
Contenu éditorial volontairement en [CONTENU À FOURNIR] (aucun remplissage générique/dupliqué)."""
import json, os

BASE = "https://www.urbestudio.fr"
OUT = os.path.join(os.path.dirname(__file__), "..", "public")

PH = "[CONTENU À FOURNIR]"

LABELS = {
    "mixage-mastering-en-ligne": "Mixage & mastering en ligne",
    "mixage-rap-en-ligne": "Mixage rap en ligne",
    "mixage-trap-en-ligne": "Mixage trap en ligne",
    "mixage-drill-en-ligne": "Mixage drill en ligne",
    "mixage-afro-en-ligne": "Mixage afro en ligne",
    "mixage-rnb-en-ligne": "Mixage R&B en ligne",
    "mastering-en-ligne": "Mastering en ligne",
    "studio-enregistrement-rap-paris-10": "Studio d'enregistrement rap · Paris 10ᵉ",
}

# Design system repris des blogs + ajouts a11y (focus-visible) et grilles réutilisables.
STYLE = """<style>
  *{box-sizing:border-box}
  body{margin:0;background:#080808;color:#f1ece7;font-family:'Plus Jakarta Sans',system-ui,sans-serif;line-height:1.7}
  a{color:#c12c2c}
  :focus-visible{outline:2px solid #c12c2c;outline-offset:2px;border-radius:3px}
  .wrap{max-width:860px;margin:0 auto;padding:0 24px}
  header.site{border-bottom:1px solid rgba(241,236,231,0.1);padding:18px 0;position:sticky;top:0;background:rgba(8,8,8,0.92);backdrop-filter:blur(10px);z-index:5}
  header.site .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px}
  .logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:24px;letter-spacing:0.04em;color:#f1ece7;text-decoration:none}
  .logo b{color:#c12c2c}
  .btn{background:#8B1E1E;color:#fff;padding:10px 20px;border-radius:100px;text-decoration:none;font-weight:700;font-size:13px;white-space:nowrap;display:inline-block}
  .btn:hover{background:#a52424}
  .crumb{font-family:'Space Mono',monospace;font-size:11px;color:rgba(241,236,231,0.5);padding:22px 0 0}
  .crumb a{color:rgba(241,236,231,0.5)}
  article{padding:18px 0 56px}
  .eyebrow{font-family:'Space Mono',monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c12c2c;margin:18px 0 14px}
  h1{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(40px,7vw,64px);line-height:0.95;letter-spacing:0.01em;margin:0 0 18px;text-transform:uppercase}
  .lead{font-size:19px;color:rgba(241,236,231,0.82);font-weight:300;margin-bottom:26px}
  .hero-img{width:100%;height:auto;border-radius:16px;margin:8px 0 30px;display:block;border:1px solid rgba(241,236,231,0.08)}
  h2{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:30px;letter-spacing:0.01em;margin:46px 0 12px;text-transform:uppercase}
  p{margin:0 0 16px;color:rgba(241,236,231,0.82)}
  ul{color:rgba(241,236,231,0.82);padding-left:20px}
  li{margin:6px 0}
  .ph{color:rgba(241,236,231,0.45);font-style:italic;border-left:2px solid rgba(193,44,44,0.5);padding-left:12px}
  .card{background:#101010;border:1px solid rgba(241,236,231,0.1);border-radius:14px;padding:18px}
  .grid{display:grid;gap:14px}
  .grid.cols-2{grid-template-columns:repeat(2,1fr)}
  .grid.cols-4{grid-template-columns:repeat(4,1fr)}
  @media(max-width:640px){.grid.cols-4{grid-template-columns:repeat(2,1fr)}.grid.cols-2{grid-template-columns:1fr}}
  .eng{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:18px;text-transform:uppercase}
  .eng span{display:block;font-family:'Plus Jakarta Sans';font-weight:400;font-size:12px;color:rgba(241,236,231,0.55);text-transform:none}
  .thumb{width:100%;height:auto;border-radius:10px;display:block;border:1px solid rgba(241,236,231,0.08)}
  .badge{display:inline-block;font-family:'Space Mono',monospace;font-size:11px;letter-spacing:0.08em;color:#3ad17a;border:1px solid rgba(58,209,122,0.35);border-radius:100px;padding:4px 12px;margin-bottom:14px}
  .audio{display:flex;flex-direction:column;gap:6px}
  .audio audio{width:100%}
  .steps{counter-reset:s;list-style:none;padding:0}
  .steps li{counter-increment:s;position:relative;padding:10px 0 10px 44px}
  .steps li::before{content:counter(s);position:absolute;left:0;top:8px;width:28px;height:28px;border-radius:50%;background:#8B1E1E;color:#fff;font-family:'Barlow Condensed';font-weight:800;display:flex;align-items:center;justify-content:center}
  details{border:1px solid rgba(241,236,231,0.1);border-radius:12px;padding:14px 16px;margin:8px 0;background:#0d0d0d}
  details summary{cursor:pointer;font-weight:700;color:#f1ece7}
  details[open] summary{color:#c12c2c}
  .cta{margin:48px 0 0;padding:28px;border:1px solid rgba(139,30,30,0.45);border-radius:18px;background:#101010;text-align:center}
  .cta h2{margin:0 0 8px}
  .cta p{color:rgba(241,236,231,0.6);margin-bottom:18px}
  .related{margin:48px 0 0;border-top:1px solid rgba(241,236,231,0.1);padding-top:28px}
  .related h2{font-size:22px;margin-top:0}
  .related a{display:block;margin:8px 0;color:#f1ece7;text-decoration:none;font-weight:500}
  .related a:hover{color:#c12c2c}
  footer.site{border-top:1px solid rgba(241,236,231,0.1);padding:28px 0 48px;font-size:13px;color:rgba(241,236,231,0.5)}
  footer.site a{color:#c12c2c}
</style>"""

ENGINEERS = [
    ("Virgile", "Rap · Mix"), ("Olid", "Prise de son · DA"),
    ("Chourak", "Pop · R&B"), ("BMS", "Compo · Prod"),
]
CREDITS = ["covers/sheriff.jpg", "covers/gotti.jpg", "covers/nono.jpg", "covers/cashdico.jpg"]

SAME_AS = [
    "https://www.instagram.com/urbestudio",
    "https://open.spotify.com/playlist/47SYmVwSFHwMFFScujjiul",
    "https://www.youtube.com/@urbestudio",
]

def studio_schema():
    return {
        "@context": "https://schema.org", "@type": "RecordingStudio",
        "name": "Urbe Studio",
        "image": BASE + "/studio/cabine2.jpg",
        "url": BASE + "/",
        "telephone": "[TÉLÉPHONE À FOURNIR]",
        "email": "contact@urbestudio.fr",
        "priceRange": "à partir de 20€",
        "address": {"@type": "PostalAddress", "streetAddress": "37 rue d'Hauteville",
                     "postalCode": "75010", "addressLocality": "Paris", "addressCountry": "FR"},
        "openingHoursSpecification": {"@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
            "opens": "00:00", "closes": "23:59"},
        "sameAs": SAME_AS,
    }

def service_schema(p):
    return {
        "@context": "https://schema.org", "@type": "Service",
        "serviceType": p["service_type"],
        "name": p["h1"],
        "description": p["desc"],
        "url": BASE + "/" + p["slug"] + "/",
        "provider": {"@type": "RecordingStudio", "name": "Urbe Studio",
                      "address": {"@type": "PostalAddress", "streetAddress": "37 rue d'Hauteville",
                                   "postalCode": "75010", "addressLocality": "Paris", "addressCountry": "FR"}},
        "areaServed": ([{"@type": "Country", "name": "France"}] if p["online"] else []) +
                      [{"@type": "City", "name": "Paris"}, {"@type": "AdministrativeArea", "name": "Île-de-France"}],
    }

def breadcrumb_schema(p):
    items = [{"@type": "ListItem", "position": 1, "name": "Accueil", "item": BASE + "/"}]
    pos = 2
    if p["parent"]:
        items.append({"@type": "ListItem", "position": pos, "name": LABELS[p["parent"]],
                       "item": BASE + "/" + p["parent"] + "/"})
        pos += 1
    items.append({"@type": "ListItem", "position": pos, "name": LABELS[p["slug"]],
                   "item": BASE + "/" + p["slug"] + "/"})
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items}

def faq_schema(p):
    qa = [x for x in p["faq"] if x[1]]  # uniquement les réponses réelles (pas les placeholders)
    if not qa:
        return None
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q,
                             "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in qa]}

def ld_block(p):
    schemas = [service_schema(p), breadcrumb_schema(p)]
    fq = faq_schema(p)
    if fq:
        schemas.append(fq)
    if p["type"] in ("pillar", "local"):
        schemas.append(studio_schema())
    return "\n".join('<script type="application/ld+json">\n' +
                     json.dumps(s, ensure_ascii=False, indent=2) + "\n</script>" for s in schemas)

def related_html(p):
    links = []
    if p["parent"]:
        links.append((p["parent"], "→ " + LABELS[p["parent"]] + " (page pilier)"))
    for s in p["siblings"]:
        links.append((s, "→ " + LABELS[s]))
    out = '<nav class="related" aria-label="Pages liées">\n<h2>À découvrir aussi</h2>\n'
    for slug, label in links:
        out += '<a href="/{}/">{}</a>\n'.format(slug, label)
    out += "</nav>"
    return out

def faq_html(p):
    out = '<h2>FAQ — {}</h2>\n'.format(LABELS[p["slug"]])
    for q, a in p["faq"]:
        ans = a if a else '<span class="ph">[RÉPONSE À FOURNIR]</span>'
        out += "<details><summary>{}</summary><p>{}</p></details>\n".format(q, ans)
    return out

def engineers_html():
    cells = "".join(
        '<div class="card"><div class="eng">{}<span>{}</span></div></div>'.format(n, s)
        for n, s in ENGINEERS)
    return '<h2>Tes ingénieurs</h2>\n<div class="grid cols-4">{}</div>\n<p class="ph">[CONTENU À FOURNIR — bio courte de chaque ingénieur]</p>'.format(cells)

def credits_html():
    cells = "".join(
        '<img class="thumb" src="/{}" width="1500" height="1500" loading="lazy" decoding="async" alt="Projet mixé par Urbe Studio" />'.format(c)
        for c in CREDITS)
    return '<h2>Ils nous ont fait confiance</h2>\n<div class="grid cols-4">{}</div>\n<p class="ph">[CONTENU À FOURNIR — crédits & collaborations détaillés]</p>'.format(cells)

def page_html(p):
    url = "{}/{}/".format(BASE, p["slug"])
    iw, ih = p["hero_dim"]
    head = (
        "<!DOCTYPE html>\n<html lang=\"fr\">\n<head>\n"
        '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        "<title>{title}</title>\n".format(title=p["title"]) +
        '<meta name="description" content="{}" />\n'.format(p["desc"]) +
        '<meta name="keywords" content="{}" />\n'.format(p["keywords"]) +
        '<meta name="robots" content="index, follow" />\n' +
        '<link rel="canonical" href="{}" />\n'.format(url) +
        '<meta property="og:type" content="website" />\n' +
        '<meta property="og:title" content="{}" />\n'.format(p["h1"]) +
        '<meta property="og:description" content="{}" />\n'.format(p["desc"]) +
        '<meta property="og:url" content="{}" />\n'.format(url) +
        '<meta property="og:image" content="{}/{}" />\n'.format(BASE, p["hero"]) +
        '<meta property="og:locale" content="fr_FR" />\n' +
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;700;800&family=Barlow+Condensed:wght@700;800;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">\n' +
        ld_block(p) + "\n" + STYLE + "\n</head>\n"
    )
    crumb = '<a href="/">Accueil</a> · '
    if p["parent"]:
        crumb += '<a href="/{}/">{}</a> · '.format(p["parent"], LABELS[p["parent"]])
    crumb += LABELS[p["slug"]]

    body = (
        "<body>\n"
        '<header class="site"><div class="wrap">'
        '<a class="logo" href="/">URBE<b>.</b>STUDIO</a>'
        '<a class="btn" href="/#reserver">Réserver →</a>'
        "</div></header>\n"
        '<div class="wrap">\n'
        '<nav class="crumb" aria-label="Fil d\'Ariane">{}</nav>\n'.format(crumb) +
        '<main>\n<article>\n'
        '<div class="eyebrow">{}</div>\n'.format(p["eyebrow"]) +
        "<h1>{}</h1>\n".format(p["h1"]) +
        '<p class="lead">{}</p>\n'.format(p["lead"]) +
        '<img class="hero-img" src="/{}" width="{}" height="{}" loading="lazy" decoding="async" alt="{}" />\n'.format(p["hero"], iw, ih, p["hero_alt"]) +
        # Différenciateur
        '<span class="badge">100% HUMAIN</span>\n'
        '<h2>Traité par un ingénieur — pas d\'IA, pas de preset</h2>\n'
        '<p>Chaque {} est mixé à la main par un ingénieur du son dédié. Aucune chaîne automatique, aucun preset générique : des décisions artistiques, prises à l\'oreille, pour ton morceau.</p>\n'.format(p["kw"]) +
        '<p class="ph">[CONTENU À FOURNIR — angle spécifique {}]</p>\n'.format(p["kw"]) +
        # Avant / Après
        '<h2>Avant / Après</h2>\n'
        '<div class="grid cols-2">'
        '<div class="card audio"><strong>Avant</strong><audio controls preload="none" src="#" aria-label="Extrait avant mixage"></audio><span class="ph">[FICHIER AUDIO À FOURNIR]</span></div>'
        '<div class="card audio"><strong>Après</strong><audio controls preload="none" src="#" aria-label="Extrait après mixage"></audio><span class="ph">[FICHIER AUDIO À FOURNIR]</span></div>'
        "</div>\n" +
        credits_html() + "\n" +
        engineers_html() + "\n" +
        # Matériel
        '<h2>Le matériel</h2>\n<p class="ph">[CONTENU À FOURNIR — liste du matériel : convertisseurs, micros, monitoring, traitement…]</p>\n' +
        # Tarifs (marketing, "à partir de")
        '<h2>Tarifs</h2>\n'
        "<ul>\n"
        "<li>Mixage — <strong>à partir de 120€</strong> / titre · livraison 7 jours</li>\n"
        "<li>Urgence 48h — <strong>+50€</strong></li>\n"
        "<li>Mastering — <strong>50€</strong> / titre · <em>1 mix acheté = 1 master offert</em></li>\n"
        "</ul>\n"
        '<p class="ph">[CONTENU À FOURNIR — détail des formules / révisions incluses]</p>\n' +
        # Process
        '<h2>Le process en 4 étapes</h2>\n'
        '<ol class="steps">'
        "<li>Tu envoies tes pistes (stems) via le tunnel de réservation.</li>"
        "<li>Un ingénieur dédié mixe ton titre.</li>"
        "<li>Tu écoutes, tu valides — révisions incluses.</li>"
        "<li>On te livre le master, prêt pour le streaming.</li>"
        "</ol>\n" +
        # Avis
        '<h2>Avis clients</h2>\n<p class="ph">[AVIS À FOURNIR — témoignages réels d\'artistes]</p>\n' +
        # FAQ
        faq_html(p) +
        # CTA
        '<div class="cta"><h2>{}</h2><p>Mix à partir de 120€ · master prêt streaming · urgence 48h dispo.</p><a class="btn" href="/#reserver">Commander mon mix →</a></div>\n'.format(p["cta_title"]) +
        related_html(p) + "\n"
        "</article>\n</main>\n</div>\n"
        '<footer class="site"><div class="wrap">'
        "Urbe Studio · 37 rue d'Hauteville, 75010 Paris · Ouvert 24h/24 · Contact : "
        '<a href="mailto:contact@urbestudio.fr">contact@urbestudio.fr</a><br />'
        '<a href="/">← Retour au site</a>'
        "</div></footer>\n</body>\n</html>\n"
    )
    return head + body

# ---- Données par page (uniques : title/desc/H1/FAQ ; éditorial = placeholders) ----
FAQ_DELAI = ("Combien de temps pour recevoir mon mix ?", "Sous 7 jours en standard, ou 48h avec l'option urgence.")
FAQ_LIGNE = ("Comment se passe le mixage en ligne ?", "Tu envoies tes stems via le tunnel de réservation, un ingénieur dédié mixe ton titre, et tu reçois ton master prêt pour le streaming, révisions incluses.")

def mix_page(slug, genre, h1, title, desc, kw, hero, hero_dim, hero_alt, siblings, q_genre):
    return {
        "type": "child", "slug": slug, "parent": "mixage-mastering-en-ligne",
        "service_type": "Mixage audio", "online": True,
        "h1": h1, "title": title, "desc": desc, "kw": kw,
        "keywords": "{0}, mix {1}, mixage {1} en ligne, ingénieur du son {1}, mixage musique urbaine".format(kw, genre),
        "eyebrow": "Service · " + genre.capitalize(),
        "lead": "[CONTENU À FOURNIR — accroche unique " + genre + "]",
        "hero": hero, "hero_dim": hero_dim, "hero_alt": hero_alt,
        "siblings": siblings,
        "cta_title": "Fais mixer ton " + genre,
        "faq": [FAQ_DELAI, FAQ_LIGNE, (q_genre, "")],
    }

PAGES = [
    # ---- PILIER ----
    {
        "type": "pillar", "slug": "mixage-mastering-en-ligne", "parent": None,
        "service_type": "Mixage et mastering audio", "online": True,
        "h1": "Mixage & mastering en ligne pour la musique urbaine",
        "title": "Mixage & mastering en ligne · musique urbaine — Urbe Studio",
        "desc": "Mixage et mastering en ligne pour rap, trap, drill, afro et R&B. 100% humain, par des ingénieurs spécialisés. Master prêt streaming en 7 jours.",
        "kw": "mix",
        "keywords": "mixage et mastering en ligne, mix en ligne, mastering en ligne, mixage musique urbaine, ingénieur du son en ligne",
        "eyebrow": "Service · Pilier",
        "lead": "[CONTENU À FOURNIR — accroche unique de la page pilier]",
        "hero": "studio/cabine2.jpg", "hero_dim": (1448, 1086),
        "hero_alt": "Régie d'Urbe Studio pour le mixage et le mastering en ligne",
        "siblings": ["mixage-rap-en-ligne", "mixage-trap-en-ligne", "mixage-drill-en-ligne",
                      "mixage-afro-en-ligne", "mixage-rnb-en-ligne", "mastering-en-ligne",
                      "studio-enregistrement-rap-paris-10"],
        "cta_title": "Lance ton mix en ligne",
        "faq": [FAQ_DELAI, FAQ_LIGNE,
                 ("Quels genres mixez-vous ?", "Rap, trap, drill, afro, R&B et plus largement toutes les musiques urbaines.")],
    },
    mix_page("mixage-rap-en-ligne", "rap",
             "Mixage rap en ligne par des ingénieurs spécialisés",
             "Mixage rap en ligne · ingénieurs spécialisés — Urbe Studio",
             "Mixage rap en ligne par des ingénieurs spécialisés : voix en avant, 808 maîtrisées, master prêt streaming. Livraison 7 jours, urgence 48h.",
             "mixage rap", "covers/sheriff.jpg", (1500, 1500),
             "Mixage rap en ligne par Urbe Studio",
             ["mixage-trap-en-ligne", "mixage-drill-en-ligne", "mixage-rnb-en-ligne"],
             "Travaillez-vous le rap français et le rap US ?"),
    mix_page("mixage-trap-en-ligne", "trap",
             "Mixage trap en ligne — 808 & énergie",
             "Mixage trap en ligne · 808 maîtrisées — Urbe Studio",
             "Mixage trap en ligne : 808 qui tapent, hi-hats nets, voix saturée maîtrisée, master prêt streaming. Par des ingénieurs spécialisés.",
             "mixage trap", "covers/gotti.jpg", (1500, 1500),
             "Mixage trap en ligne par Urbe Studio",
             ["mixage-rap-en-ligne", "mixage-drill-en-ligne", "mixage-afro-en-ligne"],
             "Comment gérez-vous les 808 et la saturation des voix trap ?"),
    mix_page("mixage-drill-en-ligne", "drill",
             "Mixage drill en ligne — son sombre et tranchant",
             "Mixage drill en ligne · son sombre — Urbe Studio",
             "Mixage drill en ligne : basses sombres, sliding 808, voix tranchante et master compact prêt streaming. Ingénieurs spécialisés drill et musiques urbaines.",
             "mixage drill", "covers/nono.jpg", (1500, 1500),
             "Mixage drill en ligne par Urbe Studio",
             ["mixage-trap-en-ligne", "mixage-rap-en-ligne", "mixage-rnb-en-ligne"],
             "Gérez-vous le côté sombre et compressé typique de la drill ?"),
    mix_page("mixage-afro-en-ligne", "afro",
             "Mixage afro en ligne — groove et chaleur",
             "Mixage afro / afrobeats en ligne — Urbe Studio",
             "Mixage afro et afrobeats en ligne : groove, percussions chaleureuses, voix claires et master ouvert prêt streaming. Par des ingénieurs spécialisés.",
             "mixage afro", "covers/cashdico.jpg", (1500, 1500),
             "Mixage afro / afrobeats en ligne par Urbe Studio",
             ["mixage-rnb-en-ligne", "mixage-trap-en-ligne", "mastering-en-ligne"],
             "Travaillez-vous l'afrobeats, l'afro-trap et le coupé-décalé ?"),
    mix_page("mixage-rnb-en-ligne", "rnb",
             "Mixage R&B en ligne — voix et profondeur",
             "Mixage R&B en ligne · voix & profondeur — Urbe Studio",
             "Mixage R&B en ligne : voix soyeuses, harmonies équilibrées, low-end profond et master chaud prêt streaming. Ingénieurs spécialisés R&B et soul urbaine.",
             "mixage R&B", "covers/titi33.jpg", (1500, 1500),
             "Mixage R&B en ligne par Urbe Studio",
             ["mixage-afro-en-ligne", "mixage-rap-en-ligne", "mastering-en-ligne"],
             "Comment traitez-vous les harmonies vocales et les ad-libs R&B ?"),
    # ---- MASTERING (enfant prestation) ----
    {
        "type": "child", "slug": "mastering-en-ligne", "parent": "mixage-mastering-en-ligne",
        "service_type": "Mastering audio", "online": True,
        "h1": "Mastering en ligne prêt pour le streaming",
        "title": "Mastering en ligne · streaming & vinyle — Urbe Studio",
        "desc": "Mastering en ligne prêt pour le streaming, la radio et le vinyle : niveau, équilibre tonal et largeur, sans écraser ta dynamique. Dès 50€/titre.",
        "kw": "master",
        "keywords": "mastering en ligne, master streaming, mastering musique urbaine, mastering rap, master vinyle",
        "eyebrow": "Service · Mastering",
        "lead": "[CONTENU À FOURNIR — accroche unique mastering]",
        "hero": "covers/gotti.jpg", "hero_dim": (1500, 1500),
        "hero_alt": "Mastering en ligne par Urbe Studio",
        "siblings": ["mixage-rap-en-ligne", "mixage-afro-en-ligne", "mixage-rnb-en-ligne"],
        "cta_title": "Masterise ton titre",
        "faq": [("Le mastering suffit-il sans mixage ?", ""),
                 FAQ_LIGNE,
                 ("Pour quelles plateformes calibrez-vous le master ?", "Pour Spotify, Apple Music, YouTube, la radio et le vinyle.")],
    },
    # ---- PAGE LOCALE ----
    {
        "type": "local", "slug": "studio-enregistrement-rap-paris-10", "parent": None,
        "service_type": "Enregistrement studio", "online": False,
        "h1": "Studio d'enregistrement rap à Paris 10ᵉ",
        "title": "Studio enregistrement rap Paris 10ᵉ — Urbe Studio",
        "desc": "Studio d'enregistrement rap à Paris 10ᵉ, ouvert 24h/24. Cabine traitée, ingénieur du son, sessions rap et musiques urbaines. Réservation en ligne.",
        "kw": "enregistrement rap",
        "keywords": "studio enregistrement rap Paris, studio rap Paris 10, enregistrement rap Paris, studio musiques urbaines Paris, cabine voix Paris",
        "eyebrow": "Studio · Paris 10ᵉ",
        "lead": "[CONTENU À FOURNIR — accroche unique studio local Paris 10ᵉ]",
        "hero": "studio/cabine2.jpg", "hero_dim": (1448, 1086),
        "hero_alt": "Cabine d'enregistrement d'Urbe Studio à Paris 10ᵉ",
        "siblings": ["mixage-rap-en-ligne"],
        "cta_title": "Réserve ta session studio",
        "faq": [("Où se trouve le studio ?", "Au 37 rue d'Hauteville, Paris 10ᵉ, ouvert 24h/24 et 7j/7."),
                 ("Peut-on enregistrer avec un ingénieur du son ?", "Oui : session avec ingénieur (30€/h) ou sans ingénieur (20€/h), tarif nuit après 21h."),
                 ("Faut-il réserver à l'avance ?", "")],
    },
]

count = 0
for p in PAGES:
    d = os.path.join(OUT, p["slug"])
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "index.html"), "w", encoding="utf-8") as f:
        f.write(page_html(p))
    count += 1
    print("écrit:", "public/" + p["slug"] + "/index.html")
print("Total pages:", count)
