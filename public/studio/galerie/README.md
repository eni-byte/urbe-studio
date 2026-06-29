# Galerie « book » — médias à déposer ici

Dépose ici les fichiers référencés par la galerie déployable de la page **LE STUDIO**
(`src/main.jsx`, tableau `galerie`). Tant qu'un fichier est absent, la galerie le masque
automatiquement (slide + point), donc aucune image cassée n'apparaît en ligne.

Fichiers attendus (noms exacts) :

| Photo | Nom de fichier |
|-------|----------------|
| Le photographe + kebab (jour) | `book-photographe-kebab.jpg` |
| Les 4 filles (crépuscule)     | `book-les-filles.jpg` |
| Rappeur + cierge magique (nuit) | `book-cierge-magique.jpg` |
| La foule mains en l'air (nuit) | `book-foule.jpg` |

Format conseillé : `.jpg` ou `.webp`, ~1600 px de large. Vidéos `.mp4` (H.264, muet) acceptées.
Pour ajouter d'autres médias, dépose le fichier ici puis ajoute une entrée dans le tableau
`galerie` : `{ type: 'photo'|'video', src: 'studio/galerie/<fichier>', label: '…' }`.
