// Subtract the pressure gradient. After this the field is divergence-free:
// the gas can swirl and shear, but it cannot pile up or thin out.
uniform sampler2D uPressure;
uniform sampler2D uVelocity;

varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;

void main() {
  float l = texture2D(uPressure, vL).x;
  float r = texture2D(uPressure, vR).x;
  float t = texture2D(uPressure, vT).x;
  float b = texture2D(uPressure, vB).x;
  vec2 vel = texture2D(uVelocity, vUv).xy - vec2(r - l, t - b);
  gl_FragColor = vec4(vel, 0.0, 1.0);
}
