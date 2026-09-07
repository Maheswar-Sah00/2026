uniform float uTime;
uniform float uOpacity;
uniform float uAspect;
uniform float uLevel;      // master brightness — the button has to stay the subject
uniform float uBlur;       // mip bias, this is the gaussian
uniform sampler2D uAurora;
uniform float uHasTex;
uniform float uTexAspect;
uniform sampler2D uWarp;   // deformation map from the fluid solver
uniform float uWarpAmt;

varying vec2 vUv;

// ---------------------------------------------------------------- helpers

// Crop to cover rather than fitting the whole photo in. Fitting a portrait
// image to a wide screen means sampling ~3x its width, and the mirrored
// overspill reads as an obvious butterfly. Cropping shows one region, no seam.
vec2 coverUv(vec2 uv, float screenAspect, float texAspect) {
  vec2 s = vec2(1.0);
  if (screenAspect > texAspect) s.y = texAspect / screenAspect;
  else s.x = screenAspect / texAspect;
  return (uv - 0.5) * s + 0.5;
}

// heavy blur for free: force a deep mip level, then soften the tap grid
vec3 blurred(vec2 uv, float bias) {
  vec3 c = texture2D(uAurora, uv, bias).rgb * 0.36;
  vec2 o = vec2(0.006, 0.0);
  c += texture2D(uAurora, uv + o.xy, bias).rgb * 0.16;
  c += texture2D(uAurora, uv - o.xy, bias).rgb * 0.16;
  c += texture2D(uAurora, uv + o.yx, bias).rgb * 0.16;
  c += texture2D(uAurora, uv - o.yx, bias).rgb * 0.16;
  return c;
}

// Ember ramp: black -> wine -> crimson -> scarlet -> coral -> amber -> white.
// Deliberately the same family as the velvet, so the two stop competing.
// This is THE colour knob for the whole background.
vec3 emberRamp(float e) {
  vec3 c = mix(vec3(0.030, 0.003, 0.014), vec3(0.20, 0.015, 0.055), smoothstep(0.00, 0.22, e));
  c = mix(c, vec3(0.46, 0.045, 0.090), smoothstep(0.18, 0.42, e));
  c = mix(c, vec3(0.80, 0.130, 0.130), smoothstep(0.38, 0.60, e));
  c = mix(c, vec3(0.96, 0.330, 0.250), smoothstep(0.56, 0.76, e));
  c = mix(c, vec3(1.00, 0.520, 0.280), smoothstep(0.82, 0.95, e));
  c = mix(c, vec3(1.00, 0.780, 0.540), smoothstep(0.94, 1.00, e));
  return c;
}

void main() {
  vec2 uv = vUv;
  vec2 p = vec2((uv.x - 0.5) * uAspect, uv.y - 0.5);

  // Where the gas has been pushed to. Applied to the nebula lookup only:
  // the stars and the vignette keep reading raw uv, so they stay put in space
  // while the cloud in front of them deforms.
  vec2 flow = texture2D(uWarp, uv).xy * uWarpAmt;

  // Every time input is fed straight into noise rather than a sine, so the
  // motion never arrives back where it started — there is no loop point.
  float slow = uTime * 0.020;

  // domain warp: the whole field is dragged around by a drifting noise flow
  vec2 warp = vec2(
    fbm(p * 1.15 + vec2(slow, 0.0)),
    fbm(p * 1.15 + vec2(5.3, -slow * 0.8))
  ) - 0.5;

  vec3 col;

  if (uHasTex > 0.5) {
    // ---- the photograph, warped and blurred so it breathes instead of sitting still
    vec2 base = coverUv(uv + flow, uAspect, uTexAspect);

    vec2 uvA = base + warp * 0.045 + vec2(uTime * 0.0035, uTime * 0.0018);
    vec2 uvB = (base - 0.5) * 1.09 + 0.5 - warp * 0.038 + vec2(-uTime * 0.0022, uTime * 0.0031);

    // two drifting samples cross-faded on a noise weight — kills any cadence
    float k = smoothstep(0.34, 0.66, fbm(vec2(uTime * 0.035, 3.7)));
    vec3 photo = mix(blurred(uvA, uBlur), blurred(uvB, uBlur), k);

    // Recolour rather than hue-rotate: take the photograph's luminance as the
    // position along the ramp, and let its own chroma tilt that position a
    // little, so the violet regions land deeper and the pink ones warmer.
    float e = dot(photo, vec3(0.299, 0.587, 0.114));
    float tilt = (photo.r - photo.b) * 0.18;
    col = emberRamp(clamp(e * 1.02 + tilt, 0.0, 1.0));
  } else {
    // ---- procedural stand-in, same palette and diagonal composition
    float ca = cos(-0.62), sa = sin(-0.62);
    mat2 R = mat2(ca, -sa, sa, ca);
    vec2 d = R * (p + warp * 0.10 + vec2(flow.x * uAspect, flow.y));

    // the hot core, up and to the left, wandering slightly
    vec2 corePos = vec2(-0.52, 0.30) + (warp.yx) * 0.10 - vec2(flow.x * uAspect, flow.y);
    float core = exp(-dot(p - corePos, p - corePos) / 0.075);

    // the bright diagonal sweep, its spine wandering on noise
    float spine = d.y - (fbm(vec2(d.x * 0.9, slow)) - 0.5) * 0.30;
    float band = exp(-(spine * spine) / 0.028);

    // striated rays running along the diagonal
    float rays = fbm(vec2(d.x * 1.6 + slow * 0.5, d.y * 5.5));
    float wisps = fbm(vec2(d.x * 0.8, d.y * 2.2) + vec2(slow * 0.7, 0.0));

    float energy = core * 1.15 + band * (0.55 + 0.45 * rays) + wisps * 0.42;
    energy *= 0.80 + 0.40 * rays;

    col = emberRamp(clamp(energy, 0.0, 1.0));
  }

  // ---- breathing. Driven by noise, not a sine, and weighted toward the
  // bright regions so the dark field stays still.
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float breath = 0.86 + 0.30 * fbm(vec2(uTime * 0.045, 11.3));
  col *= mix(1.0, breath, smoothstep(0.10, 0.62, lum));

  // ---- stars, sparse and slowly twinkling
  vec2 dens = vec2(90.0 * uAspect, 90.0);
  vec2 id = floor(uv * dens);
  vec2 gv = fract(uv * dens) - 0.5;
  vec2 jitter = (vec2(hash21(id), hash21(id + 7.3)) - 0.5) * 0.7;
  // correct for cell shape so the point is round, not elliptical
  float d = length((gv - jitter) * vec2(1.0, dens.y / dens.x * uAspect));
  float lit = step(0.972, hash21(id + 3.1));
  float twinkle = 0.35 + 0.65 * fbm(vec2(hash21(id + 1.7) * 40.0, uTime * 0.12));
  col += vec3(1.0, 0.93, 0.86) * (1.0 - smoothstep(0.0, 0.16, d)) * lit * twinkle * 0.55;

  // ---- keep it cinematic: dark corners, held-down level
  float vig = 1.0 - 0.92 * pow(length((uv - 0.5) * vec2(uAspect * 0.58, 1.0)) * 1.42, 1.4);
  col *= max(vig, 0.0);

  // heavy blur averages colour toward grey, so put the saturation back
  float grey = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(grey), col, 1.20);

  col *= uLevel;

  col = col / (1.0 + col * 0.55);        // soft shoulder, nothing clips
  col *= uOpacity;

  // dither, or wide soft gradients band on cheap panels
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 37.0) - 0.5) * 0.004 * uOpacity;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
  #include <colorspace_fragment>
}
