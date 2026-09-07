uniform float uTime;
uniform float uOpen;      // 0 = closed, 1 = fully drawn back
uniform float uVel;       // normalised pull speed, drives billow + hem drag
uniform float uFolds;     // number of folds across the panel
uniform float uGather;    // fraction of the panel width left when fully open
uniform float uPanelW;
uniform float uPanelH;
uniform float uCenterY;
uniform float uOuterX;    // world x of the edge pinned to the wall
uniform float uSide;      // +1 : fabric runs toward +x, -1 : toward -x
uniform float uFlip;      // 1 for the right panel, mirrors the fold pattern
uniform float uSeed;
uniform float uFoldDepth;

varying vec2 vFab;        // fabric-space coords, stay glued to the cloth
varying vec3 vNormalW;
varying vec3 vViewW;
varying vec3 vWorld;
varying float vFold;

// Signed fold profile across the panel. Everything lives in fabric space, so
// when the panel gathers the folds narrow on their own.
float foldField(float t, float v) {
  float free = pow(1.0 - v, 1.5);            // the rod pins the top, the hem is loose

  float wob = noise(vec2(t * 2.6 + uSeed, v * 1.7 - uTime * 0.03)) * 2.0 - 1.0;
  wob += (noise(vec2(t * 1.1 + uSeed * 0.5, v * 0.6)) * 2.0 - 1.0) * 0.8;

  // the hem swings on a delay behind the heading
  float lag = free * 1.15;
  float sway = sin(uTime * 0.45 - lag + t * 2.1 + uSeed) * 0.55 * free
             + sin(uTime * 0.26 + t * 1.3 + uSeed * 2.0) * 0.30 * free;

  float ph = t * uFolds * TAU + (1.0 - v) * 0.22;   // the drop leans as it falls

  float head = (1.0 - smoothstep(0.90, 1.0, v));     // pleats bite hard just under the rod
  float body = 0.72 + 0.28 * (1.0 - smoothstep(0.30, 0.85, v));
  float pool = 1.0 + 0.30 * (1.0 - smoothstep(0.0, 0.16, v));
  float variation = 0.62 + 0.62 * noise(vec2(t * 3.4 + uSeed * 3.0, 0.37));
  float amp = (0.40 + 0.60 * head) * body * pool * variation;

  // three detuned harmonics so no two folds repeat
  float f = 0.62 * cos(ph + wob * 1.25 + sway * 0.30)
          + 0.26 * cos(ph * 2.17 + wob * 1.60 + 1.7 + sway * 0.18)
          + 0.12 * cos(ph * 0.47 - wob * 1.10 + 2.6);

  float pleat = cos(ph * 2.0 + wob * 0.35) * 0.42 * smoothstep(0.88, 1.0, v);

  float billow = uVel * 0.85 * (0.30 + free) * sin(ph * 0.8 + uTime * 1.6);

  return (f + pleat) * amp + billow;
}

vec3 fabricPos(float t, float v) {
  // gather: every ring slides toward the wall, fabric bunches into uGather
  float g = mix(1.0, uGather, uOpen);
  float x = t * g;

  float free = pow(1.0 - v, 1.6);
  x += uVel * 0.09 * free;                   // hem trails the heading while pulling
  x += sin(uTime * 0.33 + v * 1.4 + uSeed) * 0.004 * free;

  float fold = foldField(t, v);
  float depth = uFoldDepth * (1.0 + 1.1 * uOpen);   // bunched cloth folds deeper
  float z = fold * depth;
  z += (1.0 - smoothstep(0.0, 0.10, v)) * depth * 0.55;     // hem breaks forward on the floor

  float y = uCenterY + (v - 0.5) * uPanelH;
  y -= (1.0 - smoothstep(0.0, 0.22, v)) * uPanelH * 0.010 * (0.5 + 0.5 * cos(t * uFolds * TAU));

  // once the cloth is gathered it keeps going, off the edge of the frame entirely
  float exitAmt = smoothstep(0.72, 1.0, uOpen) * 0.34;

  return vec3(uOuterX + uSide * (x - exitAmt) * uPanelW, y, z);
}

void main() {
  float t = mix(uv.x, 1.0 - uv.x, uFlip);
  float v = uv.y;

  vec3 p = fabricPos(t, v);

  // analytic-ish normal from two neighbours on the displaced surface
  float e = 0.005;
  vec3 pu = fabricPos(t + e, v);
  vec3 pv = fabricPos(t, v + e);
  vec3 n = normalize(cross(pu - p, pv - p)) * uSide;

  vFab = vec2(t, v);
  vFold = foldField(t, v);
  vNormalW = n;
  vWorld = p;
  vViewW = normalize(cameraPosition - p);

  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
