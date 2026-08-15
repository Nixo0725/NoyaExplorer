# Reprise release v1.0.0 — (moins de 10 min)

> Tout le code est terminé et poussé. Il reste UN blocage à corriger + la publication.

## 1. Supprimer le fichier qui casse le build Windows (2 min)

Le fichier `src-tauri/\home\nixo\Desktop\test2.txt` (nom avec backslashes, résidu de test)
fait échouer le checkout sur Windows (`invalid path`).

```bash
git rm --cached "src-tauri/\\home\\nixo\\Desktop\\test2.txt"
find src-tauri -maxdepth 1 -name '*test2*' -delete
git commit -m "fix: supprime le fichier de test invalide (bloquait le checkout Windows)"
git push origin main
```

## 2. Redéplacer le tag v1.0.0 sur le commit corrigé (2 min)

Le tag pointe encore vers le commit cassé → le déplacer force la relance du CI.

```bash
git tag -f v1.0.0
git push origin v1.0.0 --force
```

## 3. Attendre le build puis publier (5 min)

1. GitHub → **Actions** → « Build Release » → 4 jobs en parallèle (~15-25 min) :
   - windows-latest → `setup.exe` + `.msi`
   - ubuntu-22.04 → `.deb` + `.AppImage`
   - macos-latest x2 → `.dmg` (Intel + Apple Silicon)
2. GitHub → **Releases** → « Noya Explorer v1.0.0 » (brouillon) → vérifier les assets
   → **Publish release**.

## Bonus (si le temps le permet)

- **README** : à réécrire (fonctionnalités réelles + captures + install).
- **Avertissements CI « Node.js 20 deprecated »** : sans impact sur le build, ignorables.
- Les binaires ne sont **pas signés** (SmartScreen Windows + « développeur non identifié » macOS) :
  normal pour une v1.

## Récap état actuel (tout est DÉJÀ fait)

- 7 features implémentées, analyse globale en cache, sidebar réorganisée, Spaces retiré,
  code mort nettoyé, correctifs symlinks + chemins Unix
- `cargo check` 0 warning / 0 erreur, `npx tsc --noEmit` OK
- Commit `6e5402b` + tag `v1.0.0` poussés sur `origin` (Nixo0725/NoyaExplorer)
- Workflow CI créé (`.github/workflows/release.yml`)
