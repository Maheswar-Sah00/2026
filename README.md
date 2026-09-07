# Birthday 2026

A single cinematic journey, built one chapter at a time.

```bash
npm install
npm run dev
```

## Chapter 1 — the curtain and the aurora

Theatre curtains open on black, an aurora rises, a button invites her in.

| URL | what it does |
| --- | --- |
| `/` | plays the opening from the top |
| `/?fast` | same, at 3.2x — for iterating |
| `/?t=5.4` | freezes the timeline at 5.4s |
| `/?stir` | sweeps a synthetic cursor through the gas, for tuning the fluid without a hand on the mouse |
| `R` key | replays the opening |

### Where the knobs are

**Beat timing** lives in [src/sequence.ts](src/sequence.ts). Every moment is
positioned at an absolute second on one GSAP timeline, so any beat can be moved
without disturbing its neighbours. Whole opening runs ~13s: the panels are clear
of the frame at 9.7s, the button lands at 10.6s.

**The cloth** is procedural GLSL, not a photo — a photo cannot compress its own
folds when the panel is pulled. [src/shaders/curtain.vert.glsl](src/shaders/curtain.vert.glsl)
places every vertex in fabric space, so gathering the panel narrows the folds on
its own; the fragment shader lights it as velvet, where the nap catches light
hardest on the grazing flank of each fold.

| constant | file | effect |
| --- | --- | --- |
| `GATHER` | [src/scene/curtains.ts](src/scene/curtains.ts) | how tightly the cloth bunches before it travels off frame |
| `FOLDS` | same | fold count across one panel |
| `OVERLAP` | same | how far the panels lap past centre — controls how late the gap opens |
| `uBase` / `uSheen` / `uShadow` | same | velvet colour, sheen and shadow |
| `uFoldDepth` | same | fold depth, drives how strongly the folds shade |

**Optional photo albedo.** Drop any velvet photograph at
`public/textures/velvet.jpg` and it is picked up automatically as the base
colour, stretched across the fabric coordinates so it compresses with the folds.
Without it the procedural velvet stands on its own.

The panels do not stop at the edge — past 72% of the draw they keep travelling
until they are fully off frame, and the rod and rings fade out with them
(`exitAmt` in the vertex shader, mirrored in `fabricX()` so the rings track it).

**The background** is the photograph at `public/textures/aurora.png`, drifting
under [src/shaders/aurora.frag.glsl](src/shaders/aurora.frag.glsl). It is cropped
to cover, blurred by forcing a deep mip level, then dragged around by a domain
warp. Two warped samples cross-fade on a noise weight and every time input feeds
noise rather than a sine, so the motion has no loop point to notice. Brightness
breathes, weighted toward the bright regions so the dark field stays still.

| constant | file | effect |
| --- | --- | --- |
| `emberRamp()` | [aurora.frag.glsl](src/shaders/aurora.frag.glsl) | **the colour knob.** The photo supplies structure; this supplies every colour. Six stops, black through wine, crimson, scarlet, coral, amber. Drawn from the velvet's own family so the two do not compete |
| `LEVEL` | [src/scene/aurora.ts](src/scene/aurora.ts) | master brightness. The button is the subject; this holds the field behind it |
| `BLUR` | same | mip bias, this *is* the gaussian. Higher is softer |
| `vig` | [aurora.frag.glsl](src/shaders/aurora.frag.glsl) | how hard the corners fall away |

The photograph is recoloured rather than hue-rotated: its luminance picks a
position on `emberRamp()`, and its own chroma tilts that position slightly, so
the violet regions land deeper and the pink ones warmer. Swap the photo for any
other and it is picked up on reload (`.png` then `.jpg`) — whatever its palette,
the ramp decides the final colour. With no photo at all the shader draws its own
nebula through the same ramp.

### The gas responds to the cursor

[src/scene/fluid.ts](src/scene/fluid.ts) is a small Navier-Stokes solver on a
256-wide grid. Each frame: velocity is advected by itself, pushed by the cursor,
given its curl back by vorticity confinement, then made divergence-free by 18
Jacobi pressure iterations.

That pressure projection is the whole point. An incompressible field *cannot*
simply point away from the pointer — displaced gas has to go somewhere, so it
curls around and leaves a wake, and neighbouring regions shove each other into
secondary swirls. It is why this does not read as a mouse-follow effect.

The background is not sampled at `uv` but at `uv + warp`, where the warp field is
itself carried along by the flow and accumulates how far each parcel has
travelled ([warp.frag.glsl](src/shaders/fluid/warp.frag.glsl)). Relaxing it
toward zero is the restoring force that walks the gas home once the cursor
leaves. Stars, vignette and the DOM button all read raw coordinates, so none of
them deform.

| constant | effect |
| --- | --- |
| `FORCE` | how hard a movement pushes. Scales with cursor speed on its own |
| `VELOCITY_DISSIPATION` | energy kept per second. This is the viscosity |
| `CURL_STRENGTH` | how much it swirls versus merely parts |
| `AMBIENT` | unseen stirring, so it is never frozen when the cursor is still |
| `WARP_GAIN` / `WARP_MAX` | how far the image is allowed to deform |
| `WARP_RELAX` | deformation left after a second. Lower returns home faster |

Requires WebGL2 for half-float targets; without it the solver sits out and the
background keeps its own noise drift.

### Verifying a change

Shader errors only surface at runtime, so changes are checked in a real browser:

```bash
npm run build
cd dist && python -m http.server 4173 &
chrome --headless=new --disable-gpu --enable-unsafe-swiftshader \
  --window-size=1100,688 --virtual-time-budget=2500 \
  --user-data-dir=/tmp/ud --screenshot=shot.png "http://127.0.0.1:4173/?t=12"
```

Give each capture its own `--user-data-dir` or concurrent runs deadlock.

### Camera and microphone

The candle chapter needs both to see her blow it out. A permission bubble
arriving *there* would break the most fragile moment in the piece, so the ask
happens on the one deliberate click she makes, inside the button's own gesture
([src/media.ts](src/media.ts)). Both tracks are stopped the instant they open —
nothing is recorded, kept or sent anywhere; the point is only to have the grant
already in place.

**This needs a secure context.** `localhost` counts, so `npm run dev` is fine.
Serving the built site over plain http from a LAN address does **not** —
`navigator.mediaDevices` is simply undefined there and the request returns
`unavailable`. If she opens this on her phone it has to be over https (a deploy,
or a tunnel). Worth checking before the night rather than on it.

Refusal is not fatal: the outcome is handed to `experience:start` as a promise
in `event.detail.media`, and the journey continues either way.

### Typeface

Gambetta, self-hosted from `public/fonts` — see the attribution note there.
No remote font requests: the page has no third-party dependencies at all now.

## Next

`window` fires `experience:start` when the button is clicked — chapter 2, the
timeline opening on 1980, hooks in there.
