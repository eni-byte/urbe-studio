#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Génère les pages SEO "satellites" /guides/<slug>/ d'Urbe Studio.
Articles fournis par le client (PDF) : nettoyés ([cite] retirés, [VotreSite.com] -> CTA réel).
Pages indexables (sitemap) mais NON liées dans le menu/footer/blog. Chacune renvoie vers
la réservation + la page service pertinente. Design system des blogs réutilisé."""
import json, os

BASE = "https://www.urbestudio.fr"
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "guides")
DATE = "2026-06-26"

GUIDE_TITLES = {
    "mythe-on-arrangera-au-mixage": "Le mythe du « on arrangera ça au mixage »",
    "phase-annulation-frequences": "Phase et annulation de fréquences",
    "erreurs-compression-mixage": "4 erreurs de compression à éviter",
    "loudness-war-volume-mastering": "Loudness War : pourquoi vos morceaux sonnent moins fort",
    "bas-du-spectre-kick-basse": "Bas du spectre : basses baveuses & kick étouffé",
    "test-voiture-mixage": "Le test de la voiture : un mix qui sonne partout",
    "5-erreurs-home-studio": "5 erreurs de home studio qui plombent ton mix",
    "bible-enregistrement-home-studio": "La Bible de l'enregistrement home studio",
}

STYLE = """<style>
  *{box-sizing:border-box}
  body{margin:0;background:#080808;color:#f1ece7;font-family:'Plus Jakarta Sans',system-ui,sans-serif;line-height:1.7}
  a{color:#c12c2c}
  :focus-visible{outline:2px solid #c12c2c;outline-offset:2px;border-radius:3px}
  .wrap{max-width:760px;margin:0 auto;padding:0 24px}
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
  h1{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(34px,6vw,56px);line-height:0.98;letter-spacing:0.01em;margin:0 0 18px;text-transform:uppercase}
  .lead{font-size:18px;color:rgba(241,236,231,0.82);font-weight:300;margin-bottom:22px}
  .meta{font-family:'Space Mono',monospace;font-size:12px;color:rgba(241,236,231,0.5);margin-bottom:30px}
  h2{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:27px;letter-spacing:0.01em;margin:40px 0 12px;text-transform:uppercase}
  p{margin:0 0 16px;color:rgba(241,236,231,0.82)}
  ul{color:rgba(241,236,231,0.82);padding-left:20px}
  li{margin:7px 0}
  strong{color:#f1ece7}
  .callout{background:#101010;border:1px solid rgba(241,236,231,0.1);border-left:3px solid #c12c2c;border-radius:10px;padding:14px 18px;margin:18px 0}
  .callout strong{color:#c12c2c}
  .cta{margin:46px 0 0;padding:28px;border:1px solid rgba(139,30,30,0.45);border-radius:18px;background:#101010;text-align:center}
  .cta h2{margin:0 0 8px}
  .cta p{color:rgba(241,236,231,0.7);margin-bottom:18px}
  .related{margin:48px 0 0;border-top:1px solid rgba(241,236,231,0.1);padding-top:28px}
  .related h2{font-size:21px;margin-top:0}
  .related a{display:block;margin:8px 0;color:#f1ece7;text-decoration:none;font-weight:500}
  .related a:hover{color:#c12c2c}
  footer.site{border-top:1px solid rgba(241,236,231,0.1);padding:28px 0 48px;font-size:13px;color:rgba(241,236,231,0.5)}
  footer.site a{color:#c12c2c}
</style>"""

def ld(article):
    art = {
        "@context": "https://schema.org", "@type": "Article",
        "headline": article["h1"],
        "description": article["desc"],
        "datePublished": DATE, "dateModified": DATE,
        "inLanguage": "fr-FR",
        "author": {"@type": "Organization", "name": "Urbe Studio"},
        "publisher": {"@type": "Organization", "name": "Urbe Studio", "email": "contact@urbestudio.fr"},
        "mainEntityOfPage": BASE + "/guides/" + article["slug"] + "/",
    }
    crumb = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Accueil", "item": BASE + "/"},
            {"@type": "ListItem", "position": 2, "name": "Guides", "item": BASE + "/guides/"},
            {"@type": "ListItem", "position": 3, "name": GUIDE_TITLES[article["slug"]], "item": BASE + "/guides/" + article["slug"] + "/"},
        ],
    }
    return "\n".join('<script type="application/ld+json">\n' + json.dumps(s, ensure_ascii=False, indent=2) + "\n</script>" for s in (art, crumb))

def related_html(a):
    out = '<nav class="related" aria-label="Liens utiles">\n<h2>Pour aller plus loin</h2>\n'
    out += '<a href="{}">→ {}</a>\n'.format(a["service"][0], a["service"][1])
    if a.get("service2"):
        out += '<a href="{}">→ {}</a>\n'.format(a["service2"][0], a["service2"][1])
    for g in a.get("related_guides", []):
        out += '<a href="/guides/{}/">→ {}</a>\n'.format(g, GUIDE_TITLES[g])
    out += "</nav>"
    return out

def page(a):
    url = "{}/guides/{}/".format(BASE, a["slug"])
    head = (
        '<!DOCTYPE html>\n<html lang="fr">\n<head>\n'
        '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        "<title>{}</title>\n".format(a["title"]) +
        '<meta name="description" content="{}" />\n'.format(a["desc"]) +
        '<meta name="keywords" content="{}" />\n'.format(a["keywords"]) +
        '<meta name="robots" content="index, follow" />\n' +
        '<link rel="canonical" href="{}" />\n'.format(url) +
        '<meta property="og:type" content="article" />\n' +
        '<meta property="og:title" content="{}" />\n'.format(a["h1"]) +
        '<meta property="og:description" content="{}" />\n'.format(a["desc"]) +
        '<meta property="og:url" content="{}" />\n'.format(url) +
        '<meta property="og:locale" content="fr_FR" />\n' +
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;700;800&family=Barlow+Condensed:wght@700;800;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">\n' +
        ld(a) + "\n" + STYLE + "\n</head>\n"
    )
    cta = (
        '<div class="cta">\n<h2>{}</h2>\n<p>{}</p>\n'.format(a["cta"][0], a["cta"][1]) +
        '<a class="btn" href="/#reserver">{}</a>\n'.format(a["cta"][2]) +
        '<p style="margin-top:14px;font-size:13px;"><a href="{}">En savoir plus : {}</a></p>\n</div>'.format(a["service"][0], a["service"][1])
    )
    body = (
        "<body>\n"
        '<header class="site"><div class="wrap">'
        '<a class="logo" href="/">URBE<b>.</b>STUDIO</a>'
        '<a class="btn" href="/#reserver">Réserver →</a>'
        "</div></header>\n"
        '<div class="wrap">\n'
        '<nav class="crumb" aria-label="Fil d\'Ariane"><a href="/">Accueil</a> · Guides · {}</nav>\n'.format(GUIDE_TITLES[a["slug"]]) +
        "<main>\n<article>\n"
        '<div class="eyebrow">{}</div>\n'.format(a["eyebrow"]) +
        "<h1>{}</h1>\n".format(a["h1"]) +
        '<p class="lead">{}</p>\n'.format(a["lead"]) +
        '<div class="meta">Guide Urbe Studio · {}</div>\n'.format("26 juin 2026") +
        a["body"] + "\n" +
        cta + "\n" +
        related_html(a) + "\n"
        "</article>\n</main>\n</div>\n"
        '<footer class="site"><div class="wrap">'
        "Urbe Studio · 37 rue d'Hauteville, 75010 Paris · Mixage &amp; mastering en ligne · "
        '<a href="mailto:contact@urbestudio.fr">contact@urbestudio.fr</a><br />'
        '<a href="/">← Aller sur le site</a> · <a href="/#reserver">Réserver une session ou un mix</a>'
        "</div></footer>\n</body>\n</html>\n"
    )
    return head + body

MIX_PILIER = ("/mixage-mastering-en-ligne/", "Mixage &amp; mastering en ligne")
MIX_RAP = ("/mixage-rap-en-ligne/", "Mixage rap en ligne")
MIX_TRAP = ("/mixage-trap-en-ligne/", "Mixage trap en ligne")
MASTERING = ("/mastering-en-ligne/", "Mastering en ligne")
STUDIO = ("/studio-enregistrement-rap-paris-10/", "Studio d'enregistrement rap à Paris 10ᵉ")

ARTICLES = [
  {
    "slug": "mythe-on-arrangera-au-mixage",
    "title": "Le mythe du « on arrangera ça au mixage » — Urbe Studio",
    "h1": "Le mythe du « on arrangera ça au mixage »",
    "desc": "Penser que le mixage fait des miracles est une erreur fatale. Découvrez pourquoi un bon arrangement et une bonne prise de son font 80% du travail.",
    "keywords": "arrangement mixage, on arrangera au mixage, headroom, hiérarchie sonore, mixage rap",
    "eyebrow": "Guide · Mixage",
    "lead": "Penser que le mixage fait des miracles est une erreur fatale. Voici pourquoi un bon arrangement et une bonne prise de son font 80% du travail.",
    "service": MIX_PILIER, "service2": MIX_RAP,
    "related_guides": ["erreurs-compression-mixage", "bas-du-spectre-kick-basse"],
    "cta": ("Une structure solide = un meilleur mix", "Confie tes stems à une équipe qui comprend l'importance d'un arrangement carré.", "Commander mon mix →"),
    "body": """<p>C'est le mantra préféré des producteurs qui n'ont pas encore terminé leur morceau : « c'est un peu brouillon, mais c'est pas grave, on arrangera ça au mixage. » Vous empilez des synthés, vous ajoutez des couches de guitares, vous doublez vos voix, et vous vous dites que l'ingénieur du son pourra toujours « nettoyer » le tout plus tard.</p>
<p>C'est une erreur colossale. En tant qu'ingénieurs, nous sommes là pour <strong>sublimer votre vision</strong>, pas pour reconstruire les fondations d'une maison qui s'écroule.</p>
<h2>1. La saturation de l'espace (Headroom)</h2>
<p>Le mixage consiste à gérer l'espace et la dynamique. Si vous avez 15 pistes qui occupent toutes la même fréquence, il n'y a physiquement pas assez de place pour que chaque instrument s'exprime. Si vos pistes sont surchargées, nous devrons réduire le volume drastiquement, faisant perdre puissance et punch au morceau.</p>
<h2>2. L'arrangement est le véritable mixage</h2>
<p>Le meilleur mixage ne pourra jamais sauver une composition confuse. Si vous écrivez un morceau avec trop d'éléments, le résultat sera brouillon. Appliquez la <strong>hiérarchie sonore</strong> : déterminez l'élément principal et supprimez les pistes inutiles.</p>
<h2>3. « On mixe de la musique, pas des erreurs »</h2>
<p>Le mixage sert à magnifier l'émotion et la clarté. Si votre enregistrement contient du souffle ou des problèmes de phase, le mixage rendra ces défauts plus audibles.</p>
<div class="callout"><strong>À retenir :</strong> le mixage est la phase où l'on polit le diamant, pas celle où l'on ramasse les morceaux brisés. Plus vos décisions artistiques sont tranchées, plus nous aurons de liberté pour appliquer les traitements haut de gamme.</div>""",
  },
  {
    "slug": "phase-annulation-frequences",
    "title": "Phase et annulation de fréquences — Urbe Studio",
    "h1": "Phase et annulation de fréquences : l'ennemi invisible de vos enregistrements",
    "desc": "Vos prises manquent de corps ? Repérez et corrigez les problèmes de phase lors d'un enregistrement multi-micros (batterie, guitare, voix).",
    "keywords": "annulation de phase, problème de phase enregistrement, multi-micros, inversion polarité, prise de son",
    "eyebrow": "Guide · Enregistrement",
    "lead": "Vos guitares acoustiques ou vos prises de batterie manquent de corps ? La phase est sans doute en cause — l'ennemi le plus invisible des ingénieurs du son.",
    "service": STUDIO, "service2": MIX_PILIER,
    "related_guides": ["mythe-on-arrangera-au-mixage", "bas-du-spectre-kick-basse"],
    "cta": ("Ne laissez pas la physique détruire vos prises", "Envoyez vos multipistes : notre première étape est d'aligner parfaitement la phase de vos batteries, guitares et voix.", "Confier mes pistes →"),
    "body": """<p>Vous venez d'enregistrer une magnifique guitare acoustique ou un ampli avec deux micros pour avoir un son « plus large ». Mais une fois sur votre logiciel, le son est fin, métallique, creux, et perd toutes ses basses. Vous essayez de rajouter des graves avec un égaliseur (EQ), mais rien n'y fait : le son reste faible.</p>
<p>Félicitations, vous venez de rencontrer l'ennemi le plus redouté (et le plus invisible) des ingénieurs du son : <strong>l'annulation de phase</strong>. C'est un problème purement physique qui détruit littéralement l'énergie de vos pistes avant même que vous n'ayez commencé à mixer.</p>
<h2>1. Qu'est-ce que la phase ?</h2>
<p>Le son se déplace dans l'air sous forme de vagues (des ondes). Chaque vague possède un « sommet » (pression positive) et un « creux » (pression négative). Si vous enregistrez une source avec deux micros placés à des distances différentes, l'onde atteint le Micro A une fraction de milliseconde avant le Micro B. Résultat : le « sommet » de A tombe en même temps que le « creux » de B. Positif + négatif = zéro. Le son s'annule de lui-même.</p>
<h2>2. Le piège classique : la caisse claire ou la guitare</h2>
<p>Ce problème survient quasi systématiquement avec plusieurs micros sur une même source :</p>
<ul>
<li><strong>La caisse claire :</strong> un micro au-dessus (Top) et un en dessous (Bottom) reçoivent des pressions opposées.</li>
<li><strong>La guitare acoustique :</strong> un micro vers le manche, un vers la rosace, à des distances inégales.</li>
<li><strong>La voix et la prod :</strong> les basses de l'instru peuvent annuler les graves de la voix au mauvais moment.</li>
</ul>
<h2>3. L'épreuve de vérité : le bouton MONO</h2>
<p>Écoutez vos deux pistes écartées à gauche et à droite, puis passez le Master en mono. <strong>Le diagnostic fatal :</strong> si en mono la guitare perd son volume, que les basses disparaissent ou que le son devient nasillard (comme un vieux téléphone), vous avez un gros problème de phase.</p>
<h2>4. Le mythe du « je répare ça avec un EQ »</h2>
<p>Une annulation de phase n'est pas un problème de fréquences, c'est un problème de <em>temps</em>. Vous ne pouvez pas ajouter des basses qui ont été physiquement annulées : vous boostez du vide.</p>
<div class="callout"><strong>La seule vraie solution :</strong> inverser la polarité d'une des deux pistes (le bouton Ø), ou zoomer sur la forme d'onde et décaler manuellement une piste de quelques millisecondes pour aligner les crêtes.</div>""",
  },
  {
    "slug": "erreurs-compression-mixage",
    "title": "4 erreurs de compression à éviter — Urbe Studio",
    "h1": "4 erreurs de compression qui détruisent l'énergie de vos pistes",
    "desc": "Vous utilisez la compression au hasard ? Découvrez les 4 erreurs fatales qui tuent la dynamique de vos instruments et voix en home studio.",
    "keywords": "erreurs compression, compresseur attaque release, compression voix rap, transitoire, mixage",
    "eyebrow": "Guide · Mixage",
    "lead": "Vous utilisez la compression au hasard ? Voici les 4 erreurs fatales qui tuent la dynamique de vos instruments et voix en home studio.",
    "service": MIX_PILIER, "service2": MIX_RAP,
    "related_guides": ["loudness-war-volume-mastering", "mythe-on-arrangera-au-mixage"],
    "cta": ("La compression est un art qui s'apprend", "Confie tes pistes brutes : nos ingénieurs redonnent vie, punch et cohésion à ta musique avec des compresseurs de qualité studio.", "Commander mon mix →"),
    "body": """<p>S'il y a un outil qui terrifie les producteurs débutants, c'est le compresseur. Contrairement à un EQ, son effet est subtil et souvent invisible aux premières écoutes. Pourtant, utilisé à l'aveugle, il peut étouffer toute la vie de vos prises. Voici les 4 erreurs les plus courantes.</p>
<h2>1. Une attaque (Attack) trop rapide</h2>
<p>C'est l'erreur n°1 sur les éléments percussifs. Une attaque proche de 0 ms écrase la <strong>transitoire</strong> (le « clac » initial) : votre kick perd tout son punch et sonne comme un carton mou.</p>
<div class="callout"><strong>L'astuce de pro :</strong> laissez respirer vos transitoires. Sur un kick ou une caisse claire, commencez avec une attaque lente (15 à 30 ms) pour garder l'impact et ne compresser que la résonance.</div>
<h2>2. Un relâchement (Release) mal synchronisé</h2>
<p>Trop rapide, le son remonte brutalement et distord. Trop lent, la piste reste constamment écrasée. Réglez le Release pour que la courbe revienne à zéro juste avant le coup suivant : le compresseur doit « danser » avec le tempo.</p>
<h2>3. Compresser « en solo » sans le contexte</h2>
<p>Un réglage qui sonne énorme en solo ne fonctionne presque jamais dans le mix complet : la basse disparaît ou « bouffe » tout. Réglez toujours vos compresseurs avec les autres instruments allumés.</p>
<h2>4. Tout faire avec un seul compresseur</h2>
<p>Pour une voix qui passe du chuchotement au cri, un seul compresseur à fort ratio sonne artificiel et « pompe ».</p>
<div class="callout"><strong>La solution (compression en série) :</strong> deux compresseurs à la suite. Le premier, attaque rapide, attrape les gros pics ; le second, attaque lente et faible ratio (2:1), lisse l'ensemble. Voix puissante mais naturelle.</div>""",
  },
  {
    "slug": "loudness-war-volume-mastering",
    "title": "Loudness War : atteindre le volume des pros — Urbe Studio",
    "h1": "La guerre du volume (Loudness War) : pourquoi vos morceaux sonnent moins forts que ceux des pros",
    "desc": "Votre mix manque de puissance face aux hits de Spotify ? Les secrets de la dynamique, du limiteur et du mastering pour atteindre le volume pro.",
    "keywords": "loudness war, LUFS, limiteur mastering, volume Spotify, mastering en ligne",
    "eyebrow": "Guide · Mastering",
    "lead": "Votre mix manque de puissance comparé aux hits de Spotify ? Voici les secrets de la dynamique, du limiteur et du mastering pour atteindre le volume pro.",
    "service": MASTERING, "service2": MIX_PILIER,
    "related_guides": ["erreurs-compression-mixage", "bas-du-spectre-kick-basse"],
    "cta": ("Ton mix manque de puissance ?", "Confie ton fichier final pour un mastering pro et fais trembler les enceintes avec la même intensité que les plus grands hits.", "Masteriser mon titre →"),
    "body": """<p>Vous écoutez votre morceau dans une playlist Spotify, juste après un titre de votre artiste favori : la chute est brutale, votre son est minuscule. Vous poussez un limiteur sur le Master, le volume monte enfin… mais la caisse claire disparaît, le kick devient mou, tout semble écrasé. Bienvenue dans la <strong>Loudness War</strong>.</p>
<h2>1. Volume crête (Peak) vs volume perçu (LUFS)</h2>
<p>L'erreur fondamentale : regarder le Peak Meter. L'oreille ne perçoit pas les pics, mais la <strong>moyenne globale</strong>, mesurée en LUFS. Un titre commercial tourne entre -10 et -7 LUFS. À 0 dB crête mais -16 LUFS, votre morceau sonnera très faible à côté d'un hit.</p>
<h2>2. Le piège du limiteur magique</h2>
<p>Un limiteur est un plafond de béton. Pousser la musique contre ce plafond écrase violemment les transitoires.</p>
<div class="callout"><strong>La conséquence :</strong> +10 dB sur un seul limiteur en fin de chaîne tue la dynamique. Le son devient plat, agressif, fatigant, et perd tout son « bounce ».</div>
<h2>3. Le volume commence dans le mixage</h2>
<p>Un morceau ne devient pas fort par magie à la fin. Si le mixage contient trop de « rumble » sous 40 Hz, ces basses invisibles déclenchent le limiteur trop tôt et écrasent tout. Un mix propre permet de monter le volume bien plus facilement.</p>
<h2>4. La vraie différence entre mixage et mastering</h2>
<ul>
<li><strong>Le mixage :</strong> faire en sorte que le morceau sonne <em>bien</em> (équilibre, largeur, profondeur, émotion).</li>
<li><strong>Le mastering :</strong> faire en sorte qu'il sonne <em>fort et compétitif</em> (standards LUFS de Spotify/Apple Music) sans perdre les qualités du mix.</li>
</ul>
<p>Atteindre -8 LUFS sans détruire les transitoires demande compresseurs multibandes, clippers et limiteurs de précision en cascade, maniés par un ingénieur de mastering expérimenté.</p>""",
  },
  {
    "slug": "bas-du-spectre-kick-basse",
    "title": "Bas du spectre : kick & basse maîtrisés — Urbe Studio",
    "h1": "Basses baveuses et kick étouffé : le cauchemar du bas du spectre",
    "desc": "Apprenez à gérer les fréquences graves de vos productions en home studio. Ne laissez plus un kick ou une basse ruiner la clarté de votre morceau.",
    "keywords": "bas du spectre, kick basse 808, sidechain, high-pass filter, mixage trap, mixage rap",
    "eyebrow": "Guide · Mixage",
    "lead": "Le bas du spectre est le moteur de la musique urbaine. Apprenez à gérer kick, basse et 808 pour ne plus jamais avoir un grave brouillon.",
    "service": MIX_TRAP, "service2": MIX_RAP,
    "related_guides": ["loudness-war-volume-mastering", "test-voiture-mixage"],
    "cta": ("Un bas de spectre digne des standards de l'industrie", "Importe tes pistes : nos ingénieurs sculptent un grave puissant et défini, kick et 808 parfaitement séparés.", "Commander mon mix →"),
    "body": """<p>Ce qui sépare instantanément un mix amateur d'une prod pro, c'est la gestion du bas du spectre. Dans le Hip-Hop, l'EDM, la Pop ou le R&B, le grave est le moteur du morceau — mais en home studio, c'est souvent une zone de guerre : kick sans punch, basse envahissante, brouhaha indistinct.</p>
<h2>1. Le conflit fatal entre le kick et la basse</h2>
<p>Le kick et la basse (ou le 808) opèrent dans la même zone (30 à 100 Hz). Joués ensemble à la même intensité, ils s'additionnent et saturent le volume global.</p>
<div class="callout"><strong>L'astuce de survie :</strong> le <strong>sidechain</strong>. Cette compression baisse automatiquement la basse pendant une fraction de seconde à chaque coup de kick. Le kick respire, la basse reste présente, le mix gagne en clarté.</div>
<h2>2. L'accumulation de fréquences inutiles (le rumble)</h2>
<p>Voix, synthés, guitares accumulent un « bourdonnement » sous 60 Hz qui mange le headroom de vos vrais graves.</p>
<div class="callout"><strong>L'action concrète :</strong> des filtres coupe-bas (high-pass). Coupez sous 80–100 Hz sur les voix, charlestons, synthés aigus et guitares pour faire de la place.</div>
<h2>3. Le syndrome de la petite pièce</h2>
<p>Une onde de 40 Hz mesure plus de 8 mètres : dans une chambre, elle rebondit et s'annule ou s'additionne. Vous croyez manquer de basse, vous la boostez… et en voiture, les vitres explosent sous un sub incontrôlable.</p>
<h2>4. L'abus d'EQ sur le sub</h2>
<p>Ajouter +6 dB à 60 Hz ne donne pas de punch : ça rend le son mou et déclenche les limiteurs trop tôt. Le vrai secret est souvent de <strong>réduire</strong> les fréquences « carton » (200–300 Hz) et d'ajouter une distorsion harmonique subtile pour faire ressortir le sub sur les petites enceintes.</p>""",
  },
  {
    "slug": "test-voiture-mixage",
    "title": "Test de la voiture : un mix qui sonne partout — Urbe",
    "h1": "Le test de la voiture : pourquoi votre morceau sonne mal en dehors de votre chambre",
    "desc": "Votre morceau sonne bien chez vous mais brouillon en voiture ? Pourquoi, et comment obtenir un mixage qui sonne vraiment partout.",
    "keywords": "car test mixage, traduction du mix, acoustique chambre, monitoring, mixage qui sonne partout",
    "eyebrow": "Guide · Mixage",
    "lead": "Votre morceau sonne parfaitement chez vous mais devient brouillon dans la voiture ? Le coupable n'est ni votre talent ni vos enceintes — c'est plus sournois.",
    "service": MIX_PILIER, "service2": MIX_RAP,
    "related_guides": ["bas-du-spectre-kick-basse", "loudness-war-volume-mastering"],
    "cta": ("Un mix qui passe le « Car Test » haut la main", "Envoie tes pistes brutes : nos ingénieurs mixent dans une pièce calibrée, avec des oreilles fraîches et objectives.", "Commander mon mix →"),
    "body": """<p>Vous passez 15 heures sur un morceau. Dans votre chambre, le kick tape, les voix sont cristallines, la basse est profonde. Puis vous le branchez dans la voiture et c'est le drame : son sourd, voix qui perce, basse disparue (ou portières qui tremblent). Rassurez-vous, le coupable est sournois.</p>
<h2>1. Ta chambre te ment (le piège de l'acoustique)</h2>
<p>Une chambre n'est pas conçue pour la musique. Murs parallèles, plafond bas, fenêtres créent des « ondes stationnaires ». À l'endroit où vous êtes assis, la pièce gonfle certaines basses et en annule d'autres.</p>
<div class="callout"><strong>L'erreur fatale :</strong> vous entendez trop de basses à cause de la pièce, vous les baissez… et en voiture, votre mix n'a plus aucune basse. Vous n'avez pas mixé votre morceau, vous avez mixé les défauts de votre chambre.</div>
<h2>2. L'illusion des moniteurs haut de gamme</h2>
<p>Des enceintes à 1000 € dans une pièce non traitée, c'est un moteur de Ferrari dans une Twingo : vous foncez dans le mur avec plus de précision. Vos enceintes ne diront jamais la vérité si la pièce la déforme avant vos oreilles.</p>
<h2>3. La fatigue auditive et le manque de recul</h2>
<p>Après 4 heures sur la même boucle, votre cerveau compense et ignore les défauts. Vous montez le charleston parce que vous ne l'entendez plus, alors qu'il est déjà trop fort pour une oreille neuve.</p>
<h2>4. Pourquoi la voiture révèle tout</h2>
<p>L'habitacle est un environnement que vous connaissez par cœur : vous y écoutez vos artistes préférés tous les jours. Si votre titre sonne mal juste après un morceau de Drake ou Billie Eilish écouté au même endroit, le diagnostic est sans appel.</p>
<p>Votre rôle d'artiste est de composer et capturer l'émotion. Le rôle d'un studio, c'est une pièce calibrée, du matériel de pointe et des oreilles objectives — pour un mix qui sonne sur des AirPods, en club comme dans l'autoradio.</p>""",
  },
  {
    "slug": "5-erreurs-home-studio",
    "title": "5 erreurs de home studio qui plombent ton mix — Urbe Studio",
    "h1": "5 erreurs de home studio qui plombent ton mix (avant même le mixage)",
    "desc": "Ton morceau sonne « amateur » ? 80% d'un bon mix se joue avant le mix. Les 5 erreurs les plus courantes en home studio urbain — et comment les éviter.",
    "keywords": "erreurs home studio, enregistrer du rap chez soi, préparer son morceau pour le mixage, home studio rap trap, mixage son urbain",
    "eyebrow": "Guide · Home studio",
    "lead": "Tu envoies tes pistes à un ingé et ça sonne toujours « chambre » ? Avant d'accuser le mixeur : 80% d'un bon mix urbain se joue avant même le mix.",
    "service": MIX_PILIER, "service2": STUDIO,
    "related_guides": ["bible-enregistrement-home-studio", "phase-annulation-frequences"],
    "cta": ("Une session propre = un mix qui sonne pro", "Corrige ces 5 points et confie-nous une session que la plupart des artistes ne livrent jamais.", "Commander mon mix →"),
    "body": """<p>Tu envoies tes pistes à un ingé, il te renvoie un mix… et ça sonne toujours « chambre ». Pas assez d'air, pas assez de coffre, la voix qui ne s'installe pas. Avant d'accuser le mixeur, regarde en amont : <strong>80% d'un bon mix urbain se joue avant même le mix</strong>, dans la prise et dans la façon dont tu livres ta session.</p>
<p>Voici les cinq erreurs qu'on voit revenir le plus souvent chez Urbe Studio, et comment les éviter dès chez toi. Pour le détail complet, on a réuni tout ça dans <a href="/guides/bible-enregistrement-home-studio/">la Bible de l'enregistrement home studio</a> — un guide gratuit de 24 pages.</p>
<div class="callout"><strong>À retenir :</strong> un mix ne répare pas une mauvaise prise. Il révèle une bonne préparation.</div>
<h2>1. Le beat en MP3</h2>
<p>Un beat ripé de YouTube ou reçu en MP3 par WhatsApp est <strong>déjà compressé et dégradé</strong>. Poser une belle voix dessus, c'est monter des jantes de luxe sur une épave.</p>
<p><strong>Le réflexe :</strong> exige toujours l'instru en <strong>WAV 24 bits</strong>, au même BPM, calée pour démarrer à la mesure 1. Et garde les stems séparés (drums, 808, mélodies, FX) si ton beatmaker peut te les fournir.</p>
<h2>2. Une pièce qui résonne</h2>
<p>La pièce se grave dans ta voix : écho, réflexions, ce côté « salle de bain » qu'aucun ingé ne retire proprement. Fais le <strong>test du claquement de mains</strong> : si ça traîne avec une résonance métallique, ton micro capte la même chose.</p>
<p><strong>Le réflexe :</strong> enregistre face à une surface molle (canapé, rideaux épais, placard plein de fringues), éloigne le micro des murs nus, coupe frigo, clim et PC bruyant. Une voix proche et sèche bat toujours une voix lointaine et baveuse.</p>
<h2>3. Imprimer l'autotune et les FX à la prise</h2>
<p>Un ingé peut toujours <em>ajouter</em> un effet, il ne pourra jamais <em>retirer</em> proprement un autotune raté ou une saturation imprimée par erreur.</p>
<div class="callout"><strong>La règle d'or :</strong> livre <strong>toujours une version 100% brute</strong> de chaque piste, sans aucun plugin, en plus de ta version produite.</div>
<h2>4. Des pistes mal nommées, mal exportées</h2>
<p>« Audio_07_final_FINAL.wav », des pistes qui ne retombent pas en place, une voix exportée en stéréo… et l'ingé passe une heure à reconstituer ta session. Un export bâclé, c'est l'aller-retour assuré.</p>
<p><strong>Le réflexe :</strong> nomme tes pistes (<strong>Lead, Double L, Adlib…</strong>), exporte chaque source séparément en WAV — mono pour la voix, stéréo pour l'instru — toutes calées sur le même point de départ.</p>
<h2>5. Ne pas écrire de notes</h2>
<p>Tu connais ton morceau par cœur ; l'ingé le découvre à l'ouverture. L'énergie visée, une référence, la 808 manquante… deviner, c'est se tromper.</p>
<p><strong>Le réflexe :</strong> joins une note courte avec tes intentions et tes références. Deux lignes te font gagner un aller-retour entier.</p>
<div class="cta" style="text-align:left">
  <div class="eyebrow" style="color:var(--rouge3,#c12c2c)">Le guide gratuit</div>
  <h2 style="text-transform:uppercase">La Bible de l'enregistrement home studio</h2>
  <p>Les 5 erreurs ne sont qu'un aperçu. Le guide complet couvre toute la chaîne — du choix du micro à l'export final — avec une checklist ultime. 24 pages, gratuit, pensé pour le rap, la trap, la drill, l'afro et le R&B.</p>
  <a class="btn" href="/guides/bible-enregistrement-home-studio/">↓ Obtenir la Bible (gratuit)</a>
</div>""",
  },
]

os.makedirs(OUT, exist_ok=True)
n = 0
for a in ARTICLES:
    d = os.path.join(OUT, a["slug"])
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "index.html"), "w", encoding="utf-8") as f:
        f.write(page(a))
    n += 1
    print("écrit: public/guides/" + a["slug"] + "/index.html")
print("Total:", n)
