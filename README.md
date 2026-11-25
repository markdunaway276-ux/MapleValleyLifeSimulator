# Maple Valley Life Simulator

Modular Three.js web game. Runs in any browser (PC + phone).

## Local development
1. Open `index.html` in a browser, or serve the folder:
   ```bash
   python -m http.server 8080
   ```
2. Go to `http://localhost:8080`

## GitHub Pages (permanent link for phone checking)
1. Create a new repo on GitHub (public or private — Pages works with both on free accounts for public).
2. Upload these files (or push the folder).
3. Go to Settings → Pages → Source: Deploy from a branch → `main` / root.
4. Your link will be: `https://YOUR_USERNAME.github.io/REPO_NAME/`

Push any change and the link updates in ~1 minute. Open it on your phone anytime.

## Structure
- `src/main.js` — entry, quality detection, loop
- `src/core/` — player + input
- `src/world/` — scene building
- `src/systems/` — save (and later economy, jobs, etc.)

## Next steps
- Replace the placeholder house with your CC0 Quaternius / Elbolilloduro models
- Add more systems (economy, needs, jobs)
- Improve touch controls and on-screen buttons for mobile
- Add a quality toggle in settings
