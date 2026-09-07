import * as THREE from 'three'
import type { Stage, Viewport } from '../core/stage'
import { CAM_Z } from '../core/stage'
import common from '../shaders/common.glsl?raw'
import auroraVert from '../shaders/aurora.vert.glsl?raw'
import auroraFrag from '../shaders/aurora.frag.glsl?raw'

const DEPTH = 8 // sits well behind the curtain line so it never catches its light

/** Master brightness. The button is the subject; this keeps the field behind it. */
const LEVEL = 0.27
/** Mip bias — this is the gaussian. Higher is softer. */
const BLUR = 4.2

export class Aurora {
  readonly mesh: THREE.Mesh
  /** GSAP writes this. */
  opacity = 0

  private readonly material: THREE.ShaderMaterial
  private warpSource: { warpTexture: THREE.Texture | null } | null = null

  constructor(stage: Stage) {
    const fallback = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
    fallback.needsUpdate = true

    this.material = new THREE.ShaderMaterial({
      vertexShader: `${common}\n${auroraVert}`,
      fragmentShader: `${common}\n${auroraFrag}`,
      transparent: true,
      depthWrite: false,
      depthTest: true, // the closed panels must occlude it, they draw first
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uAspect: { value: 1 },
        uLevel: { value: LEVEL },
        uBlur: { value: BLUR },
        uAurora: { value: fallback },
        uHasTex: { value: 0 },
        uTexAspect: { value: 1 },
        uWarp: { value: fallback },
        uWarpAmt: { value: 1 },
      },
    })

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material)
    this.mesh.position.z = -DEPTH
    this.mesh.renderOrder = -10

    this.loadPhoto()

    stage.onResize((v) => this.resize(stage, v))
    stage.onFrame((_dt, elapsed) => {
      this.material.uniforms.uTime.value = elapsed
      this.material.uniforms.uOpacity.value = this.opacity
      // the solver ping-pongs its targets, so the texture must be re-read each
      // frame rather than bound once
      const warp = this.warpSource?.warpTexture
      if (warp) this.material.uniforms.uWarp.value = warp
    })
    stage.scene.add(this.mesh)
  }

  /** Hand the background the fluid whose deformation map it should read. */
  setWarpSource(source: { warpTexture: THREE.Texture | null }): void {
    this.warpSource = source
  }

  /**
   * Drop a nebula photograph at public/textures/aurora.png (or .jpg) and it
   * becomes the background. Without one the shader draws its own, same palette.
   */
  private loadPhoto(candidates = ['textures/aurora.png', 'textures/aurora.jpg']): void {
    const [head, ...rest] = candidates
    if (!head) return
    new THREE.TextureLoader().load(
      `${import.meta.env.BASE_URL}${head}`,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        // mirrored, so the warped sample can wander past the edge without a seam
        tex.wrapS = THREE.MirroredRepeatWrapping
        tex.wrapT = THREE.MirroredRepeatWrapping
        tex.minFilter = THREE.LinearMipmapLinearFilter
        tex.magFilter = THREE.LinearFilter
        tex.generateMipmaps = true
        tex.needsUpdate = true

        const img = tex.image as { width: number; height: number }
        this.material.uniforms.uTexAspect.value = img.width / img.height
        this.material.uniforms.uAurora.value = tex
        this.material.uniforms.uHasTex.value = 1
      },
      undefined,
      () => {
        // try the next name; if none exist the procedural nebula stands on its own
        this.loadPhoto(rest)
      },
    )
  }

  private resize(stage: Stage, v: Viewport): void {
    const h = stage.visibleHeightAt(CAM_Z + DEPTH) * 1.06
    this.mesh.scale.set(h * v.aspect, h, 1)
    this.material.uniforms.uAspect.value = v.aspect
  }
}
