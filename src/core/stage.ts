import * as THREE from 'three'

export const CAM_Z = 6
const FOV = 34

export interface Viewport {
  width: number
  height: number
  aspect: number
  worldW: number
  worldH: number
}

type ResizeFn = (v: Viewport) => void
type FrameFn = (dt: number, elapsed: number) => void

export class Stage {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  viewport: Viewport

  private readonly clock = new THREE.Clock()
  private readonly resizeFns: ResizeFn[] = []
  private readonly frameFns: FrameFn[] = []

  constructor(canvas: HTMLCanvasElement, opts: { preserveDrawingBuffer?: boolean } = {}) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
    })
    this.renderer.setClearColor(0x000000, 1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NoToneMapping

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)
    this.camera.position.set(0, 0, CAM_Z)

    this.scene.background = new THREE.Color(0x000000)
    this.viewport = this.measure()

    window.addEventListener('resize', this.handleResize, { passive: true })
    this.applySize()
  }

  /** Height of the frustum at a given distance in front of the camera. */
  visibleHeightAt(depth: number): number {
    return 2 * Math.tan(THREE.MathUtils.degToRad(FOV) / 2) * depth
  }

  onResize(fn: ResizeFn): void {
    this.resizeFns.push(fn)
    fn(this.viewport)
  }

  onFrame(fn: FrameFn): void {
    this.frameFns.push(fn)
  }

  start(): void {
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), 1 / 20)
      const elapsed = this.clock.getElapsedTime()
      for (const fn of this.frameFns) fn(dt, elapsed)
      this.renderer.render(this.scene, this.camera)
    })
  }

  stop(): void {
    this.renderer.setAnimationLoop(null)
  }

  private measure(): Viewport {
    const width = window.innerWidth
    const height = window.innerHeight
    const aspect = width / height
    const worldH = this.visibleHeightAt(CAM_Z)
    return { width, height, aspect, worldW: worldH * aspect, worldH }
  }

  private applySize(): void {
    const v = this.measure()
    this.viewport = v
    this.camera.aspect = v.aspect
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(v.width, v.height, false)
    for (const fn of this.resizeFns) fn(v)
  }

  private handleResize = (): void => {
    this.applySize()
  }
}
