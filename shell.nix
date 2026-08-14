# Environnement de développement Nix pour NoyaExplorer (Tauri v2)
#
# Usage :
#   nix-shell --run "npm install"
#   nix-shell --run "npm run tauri dev"
#
# Si vous préférez installer dans votre profil :
#   nix profile install nixpkgs#nodejs nixpkgs#rustup nixpkgs#webkitgtk_4_1 ...
#   (mais nix-shell reste recommandé : il gère LD_LIBRARY_PATH automatiquement)

{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  # Outils de compilation / build
  nativeBuildInputs = with pkgs; [
    pkg-config
    cargo             # compilateur backend Rust
    rustc
    rustfmt
    nodejs            # npm est fourni avec
    gcc
    binutils
  ];

  # Bibliothèques système requises par Tauri v2 (webkit2gtk-4.1, gtk3, ...)
  buildInputs = with pkgs; [
    webkitgtk_4_1     # moteur web (libwebkit2gtk-4.1, inclut javascriptcoregtk)
    gtk3
    libsoup_3         # dépendance webkitgtk 4.1
    openssl
    glib
    gdk-pixbuf
    librsvg           # rendu SVG (requis par Tauri)
    libappindicator-gtk3  # indicateur système
    xdotool           # fournit libxdo (requis par tauri)
    cairo
    pango
    harfbuzz
    fontconfig
    freetype
    dbus              # nécessaire à l'exécution
    glib-networking   # modules GIO (protocoles réseau de webkit)
    gsettings-desktop-schemas
  ];

  # Variables d'environnement indispensables pour faire tourner
  # l'application webkit/GTK sur NixOS
  shellHook = ''
    export WEBKIT_DISABLE_COMPOSITING_MODE=1
    export GIO_EXTRA_MODULES="${pkgs.glib-networking}/lib/gio/modules:$GIO_EXTRA_MODULES"
    export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:$XDG_DATA_DIRS"
    export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath (with pkgs; [ webkitgtk_4_1 gtk3 libsoup_3 openssl glib gdk-pixbuf librsvg cairo pango harfbuzz fontconfig freetype dbus libappindicator-gtk3 xdotool ])}:$LD_LIBRARY_PATH"
  '';
}
