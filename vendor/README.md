# Vendored libraries

`three/` is three.js r169 (0.169.0, MIT license, see `three/LICENSE`), copied from the
npm package so the game loads without the unpkg CDN (offline, or when unpkg is down).

Only `build/three.module.js` and the add-ons the game imports (plus what they import) are
included. If you `import` a new file from `three/addons/...`, copy it (and its own `./`
imports) from the same three.js version into `three/examples/jsm/`, keeping the folder path.
