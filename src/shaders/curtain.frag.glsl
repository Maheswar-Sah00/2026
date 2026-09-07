uniform vec3 uBase;
uniform vec3 uShadow;
uniform vec3 uSheen;
uniform vec3 uWarm;
uniform float uDim;       // stage lights fading out as the panels clear frame
uniform float uPanelH;
uniform sampler2D uTex;
uniform float uHasTex;

varying vec2 vFab;
varying vec3 vNormalW;
varying vec3 vViewW;
varying vec3 vWorld;
varying float vFold;

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewW);

  vec3 L1 = normalize(vec3(-0.40, 0.70, 0.90));   // key, house left, high
  vec3 L2 = normalize(vec3(0.50, -0.55, 0.75));   // warm footlight from the deck
  vec3 L3 = normalize(vec3(0.85, 0.15, 0.35));    // cool fill, house right

  float d1 = max(dot(N, L1), 0.0);
  float d2 = max(dot(N, L2), 0.0);
  float d3 = max(dot(N, L3), 0.0);

  // velvet: the nap catches light hardest where the surface grazes the eye,
  // which is exactly the flank of every fold
  float graze = pow(1.0 - max(dot(N, V), 0.0), 2.4);

  float micro = noise(vFab * vec2(520.0, 300.0));
  float weave = noise(vFab * vec2(1400.0, 900.0));
  float threads = noise(vec2(vFab.x * 180.0, vFab.y * 5.0));
  float nap = 0.92 + 0.10 * micro + 0.05 * weave + 0.03 * threads;

  vec3 tex = texture2D(uTex, vec2(vFab.x * 2.0, vFab.y)).rgb;
  vec3 base = mix(uBase, uBase * 0.35 + tex * 1.25, uHasTex * 0.85);

  float ao = mix(0.14, 1.0, smoothstep(-1.15, 0.85, vFold));   // valleys go dark
  ao *= mix(0.45, 1.0, (1.0 - smoothstep(0.90, 1.0, vFab.y)));         // under the heading
  ao *= mix(0.50, 1.0, smoothstep(0.0, 0.14, vFab.y));         // hem contact shadow
  ao *= mix(0.72, 1.0, smoothstep(0.0, 0.09, vFab.x));         // outer edge to the wall
  ao *= mix(0.30, 1.0, 1.0 - smoothstep(0.94, 1.0, vFab.x));   // leading edge falls into shadow

  vec3 col = uShadow * 0.90;
  col += base * (0.06 + 0.80 * pow(d1, 1.30));
  col += uWarm * (0.09 * d2 * d2);
  col += base * (0.10 * d3);
  col += uSheen * graze * (0.18 + 0.30 * d1);
  col *= ao * nap;

  // a single soft pool of light on the proscenium, fixed in world space
  float pool = 1.0 - smoothstep(0.0, uPanelH * 1.30,
                          length(vec2(vWorld.x * 0.62, vWorld.y - uPanelH * 0.05)));
  col *= 0.34 + 0.72 * pool;

  // heading tape: the cloth doubles over where it meets the rings
  col *= 1.0 - 0.35 * smoothstep(0.955, 1.0, vFab.y);

  col *= mix(1.0, 0.22, uDim);
  col = col / (1.0 + col * 0.18);                              // gentle shoulder

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
