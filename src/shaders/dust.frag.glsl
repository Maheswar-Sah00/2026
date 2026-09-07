uniform float uOpacity;

varying float vTwinkle;
varying float vSeed;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.0, 0.5, d);
  a *= a;

  // motes borrow their colour from the aurora behind them
  vec3 warm = vec3(1.00, 0.78, 0.55);
  vec3 cool = vec3(1.00, 0.60, 0.52);
  vec3 col = mix(warm, cool, fract(vSeed * 7.31));

  gl_FragColor = vec4(col, a * vTwinkle * uOpacity * 0.55);
  #include <colorspace_fragment>
}
