# Startup resource recovery

The game bundles its existing DM Sans and Libre Caslon Display fonts locally.
Their unchanged assets, SIL Open Font Licenses and pinned provenance are in
`public/fonts/README.md`. No external font service is required. Font downloads
use `font-display: swap`, so unavailable font files fall back to the existing
font stacks without blocking entry.

`StartupBoundary` surrounds all lazy game modes. A rejected lazy JavaScript/CSS
load, render failure, or synchronous renderer initialization error displays a
self-contained recovery panel. **Try again** reloads the same URL and does not
clear storage. This is not a catch-all for unavailable entry JavaScript, browser
hangs, later animation-frame errors, or WebGL context loss.

## Reproduce validation

```sh
npm ci --ignore-scripts
npm test
npm run build
node scripts/startup-regression.mjs
```

The browser script requires Playwright resolvable by Node and an installed
Chromium executable (`CHROMIUM_PATH`, default `/usr/bin/chromium`). It does not
install tools or modify browser security settings. Set `STARTUP_EVIDENCE_DIR`
for a chosen output directory; otherwise evidence is written under the system
temporary directory. `STARTUP_CASES` can select comma-separated cases.

The script serves only `dist` on `127.0.0.1:4174`, blocks external and API requests,
uses isolated saves, and checks all five entry modes, loaded font faces,
local-font fallback, lazy JS/CSS failures and renderer initialization recovery.
It records screenshots, errors and JSON results. Retry checks a storage sentinel;
this is not a full gameplay save/reload test. The default route also attempts
actual keyboard movement and compares autosaved player positions. A timeout is
a failure, not a gameplay pass. Software/cloud rendering is not Mac hardware
performance evidence.

## 2026-10-22 cloud validation

- Existing unit/integration suite: **177/177 PASS**.
- TypeScript + Vite production build: **PASS**; existing >500 kB chunk warning.
- Chromium 154.0.8037.57, Linux, headless, 1280×720/DPR1, isolated saves;
  region preset Performance, render scale75%, depth shading off.
- Browser matrix: **4 PASS, 5 FAIL**. Classic entry and its input passed; both
  bundled font families and DM Sans weights400/500/600/700 loaded. Lazy JS and
  lazy CSS failure panels/retries passed and preserved a storage sentinel.
  Blocking local font files also left classic entry usable with fallback fonts.
- Default region, wildlife, rescue and campaign each failed an actual UI click
  with a timeout after the control resolved visible/enabled/stable. No external
  resource requests or uncaught page errors were recorded in these normal cases.
  Default keyboard movement was **NOT REACHED**. No fresh3D screenshot or Mac
  performance claim is supported.
- Simulated unavailable WebGL correctly displayed recovery (**PASS**), but
  retrying into the default3D route timed out (**FAIL**).

The font-service dependency and failed-lazy-load blank screen are addressed.
**Overall playable startup is not verified fixed.** The separate3D input/rendering
stall persists in this cloud environment and needs investigation on a supported
interactive browser before this draft should be treated as ready. A recovery
boundary cannot recover a blocked browser rendering thread.

An independent minimal WebGL2 probe with normal Chromium launch passed a color
clear/readPixels check (GL error0), a real button click and screenshot in1.445s.
Its renderer was ANGLE Vulkan SwiftShader Device (Subzero). This establishes that
basic WebGL/input works on this cloud software renderer; it does not establish
full-game responsiveness or identify the cause of the game workload stall.
