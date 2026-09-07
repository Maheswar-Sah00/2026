// The deformation map the background is actually sampled through.
//
// It is carried along by the fluid and accumulates the displacement each cell
// has travelled, so the image genuinely stretches and swirls with the flow.
// Relaxing it toward zero is the restoring force that walks the gas back to its
// original shape once the cursor has gone.
uniform sampler2D uVelocity;
uniform sampler2D uWarp;
uniform vec2 uTexel;
uniform float uDt;
uniform float uGain;
uniform float uRelax;     // per-frame, computed from a per-second rate
uniform float uMax;

varying vec2 vUv;

void main() {
  vec2 vel = texture2D(uVelocity, vUv).xy;

  vec2 coord = vUv - uDt * vel * uTexel;
  vec2 w = texture2D(uWarp, coord).xy;

  w += vel * uTexel * uDt * uGain;
  w *= uRelax;

  // never let a single region stretch far enough to smear
  float m = length(w);
  w = m > uMax ? w * (uMax / m) : w;

  // settle the outermost band so the frame edge never visibly pulls
  float edge = smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.92, 1.0, vUv.x))
             * smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y));
  gl_FragColor = vec4(w * edge, 0.0, 1.0);
}
