// Semi-Lagrangian advection: each cell asks where its contents came from.
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uDt;
uniform float uDissipation;   // viscosity — the gas loses energy rather than ringing

varying vec2 vUv;

void main() {
  vec2 coord = vUv - uDt * texture2D(uVelocity, vUv).xy * uTexel;
  gl_FragColor = uDissipation * texture2D(uSource, coord);
  gl_FragColor.a = 1.0;
}
