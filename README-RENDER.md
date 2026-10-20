# Page de présentation Access4D

Site statique : tout est dans `public/` (aucune compilation nécessaire, aucun serveur, aucun pisteur).

## Voir la page chez vous

```bash
cd public
python3 -m http.server 8123      # puis ouvrir http://localhost:8123
```
(Ne l'ouvrez pas en double-cliquant sur `index.html` : les modules JavaScript exigent un serveur.)

## Mettre en ligne sur Render (gratuit)

1. Créez un dépôt GitHub avec le contenu de ce dossier (`render.yaml`, `public/`, `src/`…) et poussez-le.
2. Sur https://render.com : **New > Blueprint**, choisissez le dépôt. Render lit `render.yaml` et crée le site statique.
   (Sans Blueprint : **New > Static Site**, Build Command vide, **Publish Directory : `public`**.)
3. Après le déploiement, Render donne une adresse en `https://access4d.onrender.com`. Domaine perso : Settings > Custom Domains.
4. Dans `public/index.html`, remplacez `img/og.png` (balise `og:image`) par l'adresse complète
   `https://VOTRE-SITE/img/og.png` pour que l'aperçu s'affiche dans WhatsApp, Facebook, etc.

## Brancher les téléchargements

Tout se règle dans `public/assets/js/config.js`. Deux façons :

- **Fichiers sur Render** : déposez-les dans `public/downloads/` avec les noms attendus (voir `public/downloads/LISEZ-MOI.txt`).
- **Fichiers ailleurs (recommandé pour les gros fichiers)** : publiez-les dans une *Release* GitHub et collez leur adresse complète
  (`https://github.com/…/releases/download/v0.5.0/Access4D-Setup-0.5.0.exe`) à la place du chemin relatif.

Tant qu'un fichier n'existe pas, son bouton affiche « Bientôt disponible » au lieu d'un lien cassé ; il s'active tout seul
dès que le fichier est accessible. La page détecte aussi le système du visiteur (Windows, Linux, Android) et met sa colonne en avant.

**Android** : il n'existe pas encore de version Android d'Access4D (le projet actuel est une application de bureau Electron).
Le bouton Android reste donc sur « Bientôt disponible » tant que vous n'avez pas publié un `.apk`.

## Modifier la page

- Texte : `public/index.html`. Style : `public/assets/css/style.css`.
- Animations 3D : `src/main.js`, puis `npm install` (une fois) et `npm run build` pour régénérer `public/assets/js/main.js`.
- Les mesures de la section « Mesuré, pas deviné » viennent du journal de version d'Access4D v0.4 (rendu logiciel, environnement de
  test Linux) : mettez-les à jour si vous refaites des mesures.
- Les pages d'époque (Café du Lac) sont fictives, et l'illustration le dit.

Polices : Geist (licence SIL OFL, voir `public/fonts/LICENSE-Geist.txt`). Three.js : licence MIT.
