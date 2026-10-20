/* ==========================================================================
   Configuration des téléchargements : c'est ici (et seulement ici) que vous changez les liens.

   Chaque "url" peut être :
   - un fichier posé dans le dossier public/downloads/ de ce site (chemin relatif, ex. "downloads/Access4D-Setup-0.5.0.exe") ;
   - ou une adresse complète (ex. une release GitHub).

   Si le fichier n'existe pas (chemin relatif), le bouton affiche « Bientôt disponible » au lieu d'un lien cassé :
   il s'active tout seul dès que le fichier est publié.
   ========================================================================== */
window.ACCESS4D = {
  version: "0.5.0",
  downloads: {
    // Windows : pas encore construit. Quand l'installateur sera dans la Release, remplacez par :
    // "https://github.com/mwendojean21-hue/Access4D/releases/download/v0.5.0/Access4D-Setup-0.5.0.exe"
    windows: { url: "downloads/Access4D-Setup-0.5.0.exe" },
    linux: {
      url: "https://github.com/mwendojean21-hue/Access4D/releases/download/v0.5.0/access4d_0.5.0_amd64.deb",
      appimage: "https://github.com/mwendojean21-hue/Access4D/releases/download/v0.5.0/Access4D-0.5.0.AppImage"
    },
    android: { url: "https://github.com/mwendojean21-hue/Access4D/releases/download/v0.5.0/Access4D-0.5.0.apk" }
  }
};