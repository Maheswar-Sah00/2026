// Vorticity confinement: numerical diffusion eats small eddies, this feeds them
// back. It is what makes the gas curl around the cursor instead of just parting.
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uCurlStrength;
uniform float uDt;

varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;

void main() {
  float l = texture2D(uCurl, vL).x;
  float r = texture2D(uCurl, vR).x;
  float t = texture2D(uCurl, vT).x;
  float b = texture2D(uCurl, vB).x;
  float c = texture2D(uCurl, vUv).x;

  vec2 force = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
  force /= length(force) + 0.0001;
  force *= uCurlStrength * c;
  force.y *= -1.0;

  vec2 vel = texture2D(uVelocity, vUv).xy + force * uDt;
  gl_FragColor = vec4(clamp(vel, -1200.0, 1200.0), 0.0, 1.0);
}
