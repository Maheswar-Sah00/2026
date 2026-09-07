import * as THREE from 'three'
import type { Stage, Viewport } from '../core/stage'
import common from '../shaders/common.glsl?raw'
import baseVert from '../shaders/fluid/base.vert.glsl?raw'
import advectFrag from '../shaders/fluid/advect.frag.glsl?raw'
import splatFrag from '../shaders/fluid/splat.frag.glsl?raw'
import ambientFrag from '../shaders/fluid/ambient.frag.glsl?raw'
import curlFrag from '../shaders/fluid/curl.frag.glsl?raw'
import vorticityFrag from '../shaders/fluid/vorticity.frag.glsl?raw'
import divergenceFrag from '../shaders/fluid/divergence.frag.glsl?raw'
import pressureFrag from '../shaders/fluid/pressure.frag.glsl?raw'
import gradientFrag from '../shaders/fluid/gradient.frag.glsl?raw'
import clearFrag from '../shaders/fluid/clear.frag.glsl?raw'
import warpFrag from '../shaders/fluid/warp.frag.glsl?raw'

/** Long edge of the simulation grid. The field is smooth; it does not need pixels. */
const SIM = 256
const PRESSURE_ITERATIONS = 18

/** Momentum a cursor movement injects. Scales with speed, so fast strokes hit harder. */
const FORCE = 5200
/** Radius of that push, in squared uv. */
const SPLAT_RADIUS = 0.00035
/** Energy retained per second. This is the viscosity. */
const VELOCITY_DISSIPATION = 0.16
/** Feeds small eddies back in, so the gas curls rather than merely parting. */
const CURL_STRENGTH = 22
/** Constant unseen stirring, so the nebula is never frozen. */
const AMBIENT = 34
/** How strongly flow turns into image displacement. */
const WARP_GAIN = 0.55
/** Deformation left after one second. This is the slow return home. */
const WARP_RELAX = 0.55
/** Ceiling on displacement, in uv. Past this the photograph smears. */
const WARP_MAX = 0.075

interface Swap {
  read: THREE.WebGLRenderTarget
  write: THREE.WebGLRenderTarget
  swap: () => void
}

/**
 * A small Navier-Stokes solver.
 *
 * Velocity is advected by itself, pushed by the cursor, given its curl back,
 * then made divergence-free by a Jacobi pressure solve. That projection is what
 * separates this from a mouse-follow effect: an incompressible field cannot
 * simply point away from the pointer, it has to curl around it and send the
 * displaced gas somewhere, which is where the wake and the secondary swirls
 * come from.
 */
export class Fluid {
  /** Deformation map for the background, or null where float targets are unsupported. */
  get warpTexture(): THREE.Texture | null {
    return this.supported ? this.warp.read.texture : null
  }

  /** Drive the pointer by hand, in client pixels. Used by the ?stir dev flag. */
  movePointer(clientX: number, clientY: number): void {
    if (this.supported) this.setPointer(clientX, clientY)
  }

  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private readonly quad: THREE.Mesh

  private readonly materials: Record<string, THREE.ShaderMaterial> = {}
  private velocity!: Swap
  private pressure!: Swap
  private warp!: Swap
  private curl!: THREE.WebGLRenderTarget
  private divergence!: THREE.WebGLRenderTarget

  private width = SIM
  private height = SIM
  private aspect = 1
  private supported = true

  private readonly pointer = new THREE.Vector2(0.5, 0.5)
  private readonly last = new THREE.Vector2(0.5, 0.5)
  private moved = false
  private seen = false

  constructor(stage: Stage) {
    this.renderer = stage.renderer

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    this.scene.add(this.quad)

    // half-float render targets are the whole basis of the solver
    this.supported = this.renderer.capabilities.isWebGL2
    if (!this.supported) return

    this.buildMaterials()

    stage.onResize((v) => this.allocate(v))
    stage.onFrame((dt) => this.step(dt))

    window.addEventListener('pointermove', this.onPointer, { passive: true })
    window.addEventListener('touchmove', this.onTouch, { passive: true })
  }

  private material(
    fragmentShader: string,
    uniforms: Record<string, THREE.IUniform>,
  ): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: baseVert,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      uniforms: { uTexel: { value: new THREE.Vector2() }, ...uniforms },
    })
  }

  private buildMaterials(): void {
    const tex = (): THREE.IUniform => ({ value: null })
    const num = (v = 0): THREE.IUniform => ({ value: v })
    const vec = (): THREE.IUniform => ({ value: new THREE.Vector2() })

    this.materials.advect = this.material(advectFrag, {
      uVelocity: tex(),
      uSource: tex(),
      uDt: num(),
      uDissipation: num(1),
    })
    this.materials.splat = this.material(splatFrag, {
      uTarget: tex(),
      uPoint: vec(),
      uForce: vec(),
      uRadius: num(SPLAT_RADIUS),
      uAspect: num(1),
    })
    this.materials.ambient = this.material(`${common}\n${ambientFrag}`, {
      uVelocity: tex(),
      uTime: num(),
      uAmount: num(AMBIENT),
      uDt: num(),
      uAspect: num(1),
    })
    this.materials.curl = this.material(curlFrag, { uVelocity: tex() })
    this.materials.vorticity = this.material(vorticityFrag, {
      uVelocity: tex(),
      uCurl: tex(),
      uCurlStrength: num(CURL_STRENGTH),
      uDt: num(),
    })
    this.materials.divergence = this.material(divergenceFrag, { uVelocity: tex() })
    this.materials.pressure = this.material(pressureFrag, {
      uPressure: tex(),
      uDivergence: tex(),
    })
    this.materials.gradient = this.material(gradientFrag, {
      uPressure: tex(),
      uVelocity: tex(),
    })
    this.materials.clear = this.material(clearFrag, { uTexture: tex(), uValue: num(0.8) })
    this.materials.warp = this.material(warpFrag, {
      uVelocity: tex(),
      uWarp: tex(),
      uDt: num(),
      uGain: num(WARP_GAIN),
      uRelax: num(0.99),
      uMax: num(WARP_MAX),
    })
  }

  private target(): THREE.WebGLRenderTarget {
    const rt = new THREE.WebGLRenderTarget(this.width, this.height, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    })
    rt.texture.colorSpace = THREE.NoColorSpace
    return rt
  }

  private swapTarget(): Swap {
    const s: Swap = {
      read: this.target(),
      write: this.target(),
      swap: () => {
        const tmp = s.read
        s.read = s.write
        s.write = tmp
      },
    }
    return s
  }

  private allocate(v: Viewport): void {
    this.aspect = v.aspect
    if (v.aspect >= 1) {
      this.width = SIM
      this.height = Math.max(64, Math.round(SIM / v.aspect))
    } else {
      this.height = SIM
      this.width = Math.max(64, Math.round(SIM * v.aspect))
    }

    this.dispose()
    this.velocity = this.swapTarget()
    this.pressure = this.swapTarget()
    this.warp = this.swapTarget()
    this.curl = this.target()
    this.divergence = this.target()

    const texel = new THREE.Vector2(1 / this.width, 1 / this.height)
    for (const m of Object.values(this.materials)) {
      const value = m.uniforms.uTexel.value as THREE.Vector2
      value.copy(texel)
    }
    this.materials.splat.uniforms.uAspect.value = v.aspect
    this.materials.ambient.uniforms.uAspect.value = v.aspect
  }

  private dispose(): void {
    for (const s of [this.velocity, this.pressure, this.warp]) {
      s?.read.dispose()
      s?.write.dispose()
    }
    this.curl?.dispose()
    this.divergence?.dispose()
  }

  private pass(name: string, target: THREE.WebGLRenderTarget): void {
    this.quad.material = this.materials[name]
    this.renderer.setRenderTarget(target)
    this.renderer.render(this.scene, this.camera)
  }

  private onPointer = (e: PointerEvent): void => {
    this.setPointer(e.clientX, e.clientY)
  }

  private onTouch = (e: TouchEvent): void => {
    const t = e.touches[0]
    if (t) this.setPointer(t.clientX, t.clientY)
  }

  private setPointer(x: number, y: number): void {
    this.pointer.set(x / window.innerWidth, 1 - y / window.innerHeight)
    if (!this.seen) {
      // first sighting must not fire a splat across the whole frame
      this.last.copy(this.pointer)
      this.seen = true
    }
    this.moved = true
  }

  private step(dt: number): void {
    if (!this.supported) return
    const step = THREE.MathUtils.clamp(dt, 1 / 240, 1 / 30)
    const u = (name: string) => this.materials[name].uniforms

    const autoClear = this.renderer.autoClear
    this.renderer.autoClear = false

    // --- velocity carries itself, losing energy as it goes
    u('advect').uVelocity.value = this.velocity.read.texture
    u('advect').uSource.value = this.velocity.read.texture
    u('advect').uDt.value = step
    u('advect').uDissipation.value = Math.pow(VELOCITY_DISSIPATION, step)
    this.pass('advect', this.velocity.write)
    this.velocity.swap()

    // --- unseen stirring, always
    u('ambient').uVelocity.value = this.velocity.read.texture
    u('ambient').uDt.value = step
    u('ambient').uTime.value = performance.now() / 1000
    this.pass('ambient', this.velocity.write)
    this.velocity.swap()

    // --- the cursor. Splatting along the segment keeps fast movement continuous
    // rather than leaving a dotted trail of separate pushes.
    if (this.moved) {
      const dx = this.pointer.x - this.last.x
      const dy = this.pointer.y - this.last.y
      const travel = Math.hypot(dx * this.aspect, dy)
      const steps = Math.min(4, Math.max(1, Math.ceil(travel / 0.03)))

      for (let i = 1; i <= steps; i++) {
        const k = i / steps
        const s = u('splat')
        const point = s.uPoint.value as THREE.Vector2
        const force = s.uForce.value as THREE.Vector2
        point.set(this.last.x + dx * k, this.last.y + dy * k)
        force.set((dx * FORCE) / steps, (dy * FORCE) / steps)
        s.uTarget.value = this.velocity.read.texture
        this.pass('splat', this.velocity.write)
        this.velocity.swap()
      }

      this.last.copy(this.pointer)
      this.moved = false
    }

    // --- give the small eddies back
    u('curl').uVelocity.value = this.velocity.read.texture
    this.pass('curl', this.curl)

    u('vorticity').uVelocity.value = this.velocity.read.texture
    u('vorticity').uCurl.value = this.curl.texture
    u('vorticity').uDt.value = step
    this.pass('vorticity', this.velocity.write)
    this.velocity.swap()

    // --- project onto the divergence-free part
    u('divergence').uVelocity.value = this.velocity.read.texture
    this.pass('divergence', this.divergence)

    u('clear').uTexture.value = this.pressure.read.texture
    this.pass('clear', this.pressure.write)
    this.pressure.swap()

    u('pressure').uDivergence.value = this.divergence.texture
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      u('pressure').uPressure.value = this.pressure.read.texture
      this.pass('pressure', this.pressure.write)
      this.pressure.swap()
    }

    u('gradient').uPressure.value = this.pressure.read.texture
    u('gradient').uVelocity.value = this.velocity.read.texture
    this.pass('gradient', this.velocity.write)
    this.velocity.swap()

    // --- carry the deformation map along, and let it relax home
    u('warp').uVelocity.value = this.velocity.read.texture
    u('warp').uWarp.value = this.warp.read.texture
    u('warp').uDt.value = step
    u('warp').uRelax.value = Math.pow(WARP_RELAX, step)
    this.pass('warp', this.warp.write)
    this.warp.swap()

    this.renderer.setRenderTarget(null)
    this.renderer.autoClear = autoClear
  }
}
