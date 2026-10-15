# AGENTS.md

## Overview
"Pelota que rebota" — a single-page p5.js sketch of a bouncing ball. There is no
build system, package manager, test suite, lint config, or dependencies to
install. The tracked repo is exactly two files:

- `index.html` — loads p5 **2.3.4** from the jsDelivr CDN, then `sketch.js`.
- `sketch.js` — the p5 sketch (`setup()` / `draw()`), physics state at the top.

Sound uses a **separate package**: p5 2.x no longer bundles `p5.sound.js`, so
`index.html` loads `p5.sound@0.4.1` from jsDelivr after p5. Its API differs from
the old 1.x tutorial code (`new p5.Oscillator()`, `new p5.Envelope()`, global
`userStartAudio()`). See https://github.com/processing/p5.sound.js.

## Running
- Open `index.html` directly in a browser (works over `file://`); no server,
  build, or install step exists. Reload to pick up changes — there is no watcher.
- Sound only starts after a click: browsers block audio until a user gesture, so
  `sketch.js` calls the global `userStartAudio()` in `mousePressed()`.
- Do not introduce `package.json`, a bundler, or npm tooling; nothing expects one.

## Conventions
- Visible text and code comments are all in **Spanish**. Keep new comments/UI
  consistent.
- p5 global mode: `setup`, `draw`, `circle`, `createCanvas`, etc. are globals. Do
  not `import` p5 or switch the CDN script to a module.
- Canvas is `windowWidth` x `windowHeight`; `windowResized()` keeps it in sync and
  keeps the ball inside the new bounds.

## Gotchas
- Do **not** remove the `cancelAndHoldAtTime` polyfill in `index.html` (it must
  load before p5.sound). Tone.js, bundled inside `p5.sound@0.4.1`, calls that
  native `AudioParam` method when an envelope ramps; Firefox and Safari don't
  implement it, so `env.play()` throws
  `this._param.cancelAndHoldAtTime is not a function` there.
- Bounces intentionally do **not** use physical restitution: each edge hit calls
  `impulsoVertical()` / `impulsoLateral()`, which pick a random suave / medio /
  fuerte speed so the ball never settles. Don't "fix" this into a damping model
  unless asked.
- Balls are objects in the `pelotas` array (start: one; `MAX_PELOTAS` caps the
  count). `alRebotar(p, fuerza)` is the single hook for a bounce (changes color +
  plays sound); call it from new bounce branches instead of `sonarRebote()` alone.
- The hover "slime" deformation is area-conserving on purpose
  (`rx = p.radio / deformacion`, `ry = p.radio * deformacion`, so
  `rx * ry = p.radio^2`). `tiempoCarga` (ms under the cursor) drives the stretch
  and the release impulse in `soltarPelota(p)`.
- Oversized stretch (`deformacion >= UMBRAL_DIVISION`) splits a held ball into
  two area-preserving halves (`dividirPelota`); touching balls merge back
  (`unirPelotas` / `fundirPelotas`, area + momentum conserved) except during the
  `esperaUnion` grace period right after a split.
- `sonarRebote()` is a no-op until `audioListo` is true and rate-limits to one
  sound per 60 ms. Keep that guard when adding bounces, or fast corner hits will
  spam overlapping tones.
- Particles live exactly `VIDA_PARTICULA` (10000 ms). They spawn from the cursor
  every `INTERVALO_SPAWN` ms only while `ratonActivo` and NOT `pausada` (hovering
  the ball suppresses them). `Particula.actualizar()` reflects `vx`/`vy` at all
  four edges so they never leave the canvas. On death they are simply removed;
  they fade by lerping toward `colorFin`, not by exploding or playing a sound.
