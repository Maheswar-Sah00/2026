// Autonomous drift. Curl of a noise potential is divergence-free by
// construction, so this stirs the gas without ever compressing it — the nebula
// keeps moving when nothing is touching it, and it never repeats.
uniform sampler2D uVelocity;
uniform float uTime;
uniform float uAmount;
uniform float uDt;
uniform float uAspect;

varying vec2 vUv;

vec2 curlNoise(vec2 p) {
  float e = 0.06;
  float dy = fbm(p + vec2(0.0, e)) - fbm(p - vec2(0.0, e));
  float dx = fbm(p + vec2(e, 0.0)) - fbm(p - vec2(e, 0.0));
  return vec2(dy, -dx) / (2.0 * e);
}

void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y) * 2.2 + vec2(uTime * 0.021, uTime * 0.013);
  vec2 vel = texture2D(uVelocity, vUv).xy;
  vel += curlNoise(p) * uAmount * uDt;
  gl_FragColor = vec4(vel, 0.0, 1.0);
}
