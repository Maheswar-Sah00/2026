uniform sampler2D uVelocity;

varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;

void main() {
  float l = texture2D(uVelocity, vL).y;
  float r = texture2D(uVelocity, vR).y;
  float t = texture2D(uVelocity, vT).x;
  float b = texture2D(uVelocity, vB).x;
  gl_FragColor = vec4(0.5 * (r - l - t + b), 0.0, 0.0, 1.0);
}
