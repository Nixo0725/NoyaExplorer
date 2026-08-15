# Reprise release v1.0.0 — état : CI relancé ✅

> Le blocage (fichier `test2.txt`) est **corrigé** et le build a été relancé.

## Ce qui a été fait (terminé)
- ✅ Fichier `src-tauri/\home\nixo\Desktop\test2.txt` supprimé du dépôt git et du disque
  (commit `e6f164d`)
- ✅ `main` poussé sur `origin` (`6e5402b..e6f164d`)
- ✅ Tag `v1.0.0` redéplacé sur le commit corrigé + force push
  → le workflow « Build Release » tourne sur `e6f164d2` (vérifié via API GitHub)

## Il reste à faire

### 1. Attendre le build (~15-25 min)
GitHub → **Actions** → « Build Release » → 4 jobs en parallèle :
- windows-latest → `setup.exe` + `.msi`
- ubuntu-22.04 → `.deb` + `.AppImage`
- macos-latest x2 → `.dmg` (Intel + Apple Silicon)

### 2. Publier la release
GitHub → **Releases** → « Noya Explorer v1.0.0 » (brouillon) → vérifier les assets
→ **Publish release**.

## Bonus (si le temps le permet)
- **README** à réécrire (fonctionnalités réelles + captures + install).
- Avertissements CI « Node.js 20 deprecated » : sans impact, ignorables.
- Binaires non signés (SmartScreen Windows + « développeur non identifié » macOS) :
  normal pour une v1.
