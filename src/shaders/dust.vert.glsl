uniform float uTime;
uniform float uPixelRatio;
uniform float uSpread;

attribute float aSeed;
attribute float aSize;

varying float vTwinkle;
varying float vSeed;

void main() {
  vec3 p = position;

  // slow convection, no two motes on the same path
  float t = uTime * 0.06;
  p.x += sin(t * 0.9 + aSeed * 6.2) * uSpread * 0.05;
  p.y += cos(t * 0.7 + aSeed * 4.1) * uSpread * 0.04;
  p.z += sin(t * 0.5 + aSeed * 9.7) * uSpread * 0.03;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixelRatio * (12.0 / -mv.z);

  vTwinkle = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 0.6 + aSeed * 20.0), 2.0);
  vSeed = aSeed;
}
