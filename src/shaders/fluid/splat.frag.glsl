// One push of momentum into the field, gaussian so it has no boundary.
uniform sampler2D uTarget;
uniform vec2 uPoint;
uniform vec2 uForce;
uniform float uRadius;
uniform float uAspect;

varying vec2 vUv;

void main() {
  vec2 d = vUv - uPoint;
  d.x *= uAspect;
  float fall = exp(-dot(d, d) / uRadius);
  vec2 base = texture2D(uTarget, vUv).xy;
  gl_FragColor = vec4(base + fall * uForce, 0.0, 1.0);
}
