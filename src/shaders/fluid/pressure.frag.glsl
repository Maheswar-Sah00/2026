// One Jacobi sweep of the pressure Poisson equation.
uniform sampler2D uPressure;
uniform sampler2D uDivergence;

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
  float div = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((l + r + b + t - div) * 0.25, 0.0, 0.0, 1.0);
}
