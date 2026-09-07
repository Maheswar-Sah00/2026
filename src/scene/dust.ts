import * as THREE from 'three'
import type { Stage, Viewport } from '../core/stage'
import dustVert from '../shaders/dust.vert.glsl?raw'
import dustFrag from '../shaders/dust.frag.glsl?raw'

const COUNT = 420

export class Dust {
  readonly points: THREE.Points
  /** GSAP writes this. */
  opacity = 0

  private readonly material: THREE.ShaderMaterial
  private readonly positions: Float32Array

  constructor(stage: Stage) {
    const geometry = new THREE.BufferGeometry()
    this.positions = new Float32Array(COUNT * 3)
    const seeds = new Float32Array(COUNT)
    const sizes = new Float32Array(COUNT)

    for (let i = 0; i < COUNT; i++) {
      seeds[i] = Math.random()
      sizes[i] = 0.5 + Math.pow(Math.random(), 2.2) * 2.4
      this.positions[i * 3 + 2] = -0.6 - Math.random() * 5.4
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    this.material = new THREE.ShaderMaterial({
      vertexShader: dustVert,
      fragmentShader: dustFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uSpread: { value: 1 },
      },
    })

    this.points = new THREE.Points(geometry, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = -5

    stage.onResize((v) => this.resize(v))
    stage.onFrame((_dt, elapsed) => {
      this.material.uniforms.uTime.value = elapsed
      this.material.uniforms.uOpacity.value = this.opacity
      this.points.visible = this.opacity > 0.001
    })
    stage.scene.add(this.points)
  }

  private resize(v: Viewport): void {
    // motes are scattered once per layout so they never clump on a narrow phone
    for (let i = 0; i < COUNT; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * v.worldW * 2.2
      this.positions[i * 3 + 1] = (Math.random() - 0.5) * v.worldH * 1.8
    }
    this.points.geometry.attributes.position.needsUpdate = true
    this.material.uniforms.uSpread.value = v.worldH
    this.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2)
  }
}
