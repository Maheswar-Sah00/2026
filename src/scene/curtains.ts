import * as THREE from 'three'
import type { Stage, Viewport } from '../core/stage'
import common from '../shaders/common.glsl?raw'
import curtainVert from '../shaders/curtain.vert.glsl?raw'
import curtainFrag from '../shaders/curtain.frag.glsl?raw'

/** Width the panel keeps once fully drawn back — 0 clears the frame entirely. */
export const GATHER = 0.19

const FOLDS = 8
const SEG_X = 140
const SEG_Y = 72
const RING_COUNT = 14
const OVERLAP = 1.18 // panels lap well past centre, so the gap opens late, not instantly

const srgb = (hex: number) => new THREE.Color(hex).convertSRGBToLinear()

interface Panel {
  mesh: THREE.Mesh
  material: THREE.ShaderMaterial
  rings: THREE.InstancedMesh
  side: 1 | -1
}

export class Curtains {
  readonly group = new THREE.Group()

  /** 0 closed, 1 fully drawn back. GSAP writes this. */
  open = 0
  /** 0 full stage light, 1 lights out — lets the panels sink into black. */
  dim = 0

  private readonly panels: Panel[] = []
  private readonly rod: THREE.Mesh
  private readonly finials: THREE.Mesh[] = []
  private readonly hardware = new THREE.Group()
  private readonly rodMat: THREE.MeshStandardMaterial
  private readonly ringMat: THREE.MeshStandardMaterial
  private panelW = 1
  private panelH = 1
  private prevOpen = 0
  private vel = 0
  private readonly dummy = new THREE.Object3D()

  constructor(stage: Stage) {
    const geometry = new THREE.PlaneGeometry(1, 1, SEG_X, SEG_Y)

    const fallback = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
    fallback.needsUpdate = true

    const rodMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a42,
      roughness: 0.42,
      metalness: 0.55,
      transparent: true,
    })
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x43434c,
      roughness: 0.38,
      metalness: 0.60,
      transparent: true,
    })
    this.rodMat = rodMat
    this.ringMat = ringMat

    this.rod = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24), rodMat)
    this.rod.rotation.z = Math.PI / 2
    this.hardware.add(this.rod)

    for (const x of [-1, 1]) {
      const finial = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), rodMat)
      finial.userData.dir = x
      this.finials.push(finial)
      this.hardware.add(finial)
    }

    for (const side of [1, -1] as const) {
      const material = new THREE.ShaderMaterial({
        vertexShader: `${common}\n${curtainVert}`,
        fragmentShader: `${common}\n${curtainFrag}`,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uOpen: { value: 0 },
          uVel: { value: 0 },
          uFolds: { value: FOLDS },
          uGather: { value: GATHER },
          uPanelW: { value: 1 },
          uPanelH: { value: 1 },
          uCenterY: { value: 0 },
          uOuterX: { value: 0 },
          uSide: { value: side },
          uFlip: { value: side === 1 ? 0 : 1 },
          uSeed: { value: side === 1 ? 0.0 : 11.7 },
          uFoldDepth: { value: 0.1 },
          uDim: { value: 0 },
          uBase: { value: srgb(0x7a0e1c) },
          uShadow: { value: srgb(0x120104) },
          uSheen: { value: srgb(0xc9566b) },
          uWarm: { value: srgb(0xff9a5e) },
          uTex: { value: fallback },
          uHasTex: { value: 0 },
        },
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.frustumCulled = false // vertices are placed in world space by the shader

      const rings = new THREE.InstancedMesh(
        new THREE.TorusGeometry(1, 0.32, 10, 28),
        ringMat,
        RING_COUNT,
      )
      rings.frustumCulled = false

      this.group.add(mesh, rings)
      this.panels.push({ mesh, material, rings, side })
    }

    this.group.add(this.hardware)
    this.loadVelvet(fallback)

    stage.onResize((v) => this.resize(v))
    stage.onFrame((dt, elapsed) => this.update(dt, elapsed))
    stage.scene.add(this.group)
  }

  /** World x of a point of fabric, matched to the shader's gather map. */
  fabricX(side: 1 | -1, t: number): number {
    const outer = side === 1 ? -this.panelW / OVERLAP : this.panelW / OVERLAP
    const g = THREE.MathUtils.lerp(1, GATHER, this.open)
    const exit = THREE.MathUtils.smoothstep(this.open, 0.72, 1.0) * 0.34
    return outer + side * (t * g - exit) * this.panelW
  }

  private loadVelvet(fallback: THREE.Texture): void {
    const url = `${import.meta.env.BASE_URL}textures/velvet.jpg`
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.ClampToEdgeWrapping
        for (const p of this.panels) {
          p.material.uniforms.uTex.value = tex
          p.material.uniforms.uHasTex.value = 1
        }
      },
      undefined,
      () => {
        // no photo supplied — the procedural velvet stands on its own
        for (const p of this.panels) p.material.uniforms.uTex.value = fallback
      },
    )
  }

  private resize(v: Viewport): void {
    this.panelW = (v.worldW / 2) * OVERLAP

    // the rod sits inside the frame, the cloth hangs from its rings and runs
    // off the bottom edge — exactly how a real proscenium reads
    const rodR = v.worldH * 0.019
    const rodY = v.worldH * 0.5 - rodR * 1.7
    const ringR = rodR * 1.7
    const top = rodY - rodR * 0.6 // rings overlap the heading, no gap of black
    const bottom = -v.worldH * 0.53
    this.panelH = top - bottom
    const centerY = (top + bottom) / 2

    this.rod.scale.set(rodR, v.worldW * 1.04, rodR)
    this.rod.position.set(0, rodY, 0.16)

    for (const finial of this.finials) {
      const dir = finial.userData.dir as number
      finial.scale.setScalar(rodR * 1.9)
      finial.position.set(dir * v.worldW * 0.52, rodY, 0.16)
    }

    for (const p of this.panels) {
      const u = p.material.uniforms
      u.uPanelW.value = this.panelW
      u.uPanelH.value = this.panelH
      u.uCenterY.value = centerY
      u.uOuterX.value = p.side === 1 ? -this.panelW / OVERLAP : this.panelW / OVERLAP
      u.uFoldDepth.value = this.panelW * 0.085

      p.rings.geometry.dispose()
      p.rings.geometry = new THREE.TorusGeometry(ringR, ringR * 0.22, 10, 28)
      p.rings.position.y = rodY
      p.rings.position.z = 0.16
    }
  }

  private update(dt: number, elapsed: number): void {
    // pull speed drives billow and hem drag — smoothed so GSAP eases read as inertia
    const raw = dt > 0 ? (this.open - this.prevOpen) / dt : 0
    this.vel += (THREE.MathUtils.clamp(raw * 2.4, -1.5, 1.5) - this.vel) * Math.min(1, dt * 6)
    this.prevOpen = this.open

    for (const p of this.panels) {
      const u = p.material.uniforms
      u.uTime.value = elapsed
      u.uOpen.value = this.open
      u.uVel.value = this.vel
      u.uDim.value = this.dim

      for (let i = 0; i < RING_COUNT; i++) {
        const t = i / (RING_COUNT - 1)
        this.dummy.position.set(this.fabricX(p.side, t), 0, 0)
        this.dummy.rotation.set(0, Math.PI / 2, 0) // rings encircle the rod
        this.dummy.updateMatrix()
        p.rings.setMatrixAt(i, this.dummy.matrix)
      }
      p.rings.instanceMatrix.needsUpdate = true
    }

    // the rig leaves with the cloth — a rod hanging alone over the aurora reads
    // as an artefact, so it fades on the panels' exit, not on the stage light
    const clear = THREE.MathUtils.smoothstep(this.open, 0.72, 0.94)
    const lit = (1 - this.dim) * (1 - clear)
    this.rodMat.opacity = lit
    this.ringMat.opacity = lit
    this.hardware.visible = lit > 0.01
    for (const p of this.panels) p.rings.visible = lit > 0.01
  }
}
