uniform sampler2D uVelocity;

varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;

void main() {
  float l = texture2D(uVelocity, vL).x;
  float r = texture2D(uVelocity, vR).x;
  float t = texture2D(uVelocity, vT).y;
  float b = texture2D(uVelocity, vB).y;

  // free-slip walls, so the gas slides along the frame instead of piling on it
  vec2 c = texture2D(uVelocity, vUv).xy;
  if (vL.x < 0.0) l = -c.x;
  if (vR.x > 1.0) r = -c.x;
  if (vT.y > 1.0) t = -c.y;
  if (vB.y < 0.0) b = -c.y;

  gl_FragColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}
