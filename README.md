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
- `src/systems/` — save, collision, doors, and optional debug tools (`debug.js`, `collisionViz.js`)
- `src/ui/` — inventory, door prompt, and debug UI (`debugMenu.js`, `debugOverlay.js`, `feedback.js`)

## Debug tools (all off by default)
After pressing Start a small **Debug** button appears in the bottom-right corner (works on phone). It opens a menu with big toggles and buttons:
- FPS & position overlay (FPS, x/y/z, facing, quality tier mobile/desktop)
- Collision boxes (red = houses/car, cyan = trees, green ring = you)
- Highlight interactables (gold outline + 3 m ring on every door; turns green when you are in range)
- Perf stats (draw calls, triangles, geometries, textures)
- Screenshot + markup (draw with pen/arrow/box/circle/X/numbered pin, add a note, save a PNG with a caption band)
- Teleport list: street start, front of my house, each neighbour door (SW, SE, NW, NE), west/east ends of the street, by the parked car
- Clear saved game (tap twice to confirm; you are returned to the street start)

Desktop shortcuts: `F2` or `` ` `` menu • `F3` overlay • `Shift+F3` perf stats • `F4` collision boxes • `Shift+F4` highlight interactables • `F8` teleport to street start • `Shift+F8` clear save (press twice within 4 s) • `F9` screenshot + markup. In the markup dialog: `Esc` cancels, `Ctrl/Cmd+Enter` saves.

A short list of later debug ideas lives in `DEBUG-TODO.md`.

## Next steps
- Replace the placeholder house with your CC0 Quaternius / Elbolilloduro models
- Add more systems (economy, needs, jobs)
- Improve touch controls and on-screen buttons for mobile
- Add a quality toggle in settings
