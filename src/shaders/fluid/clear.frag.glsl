uniform sampler2D uTexture;
uniform float uValue;

varying vec2 vUv;

void main() {
  gl_FragColor = uValue * texture2D(uTexture, vUv);
}
