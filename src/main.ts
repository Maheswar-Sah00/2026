import * as THREE from 'three'
import { Stage } from './core/stage'
import { Curtains } from './scene/curtains'
import { Aurora } from './scene/aurora'
import { Fluid } from './scene/fluid'
import { Dust } from './scene/dust'
import { StartButton } from './ui/startButton'
import { buildOpening } from './sequence'
import { requestStagePermissions, type MediaOutcome } from './media'
import './styles.css'

const canvas = document.getElementById('stage')
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('#stage canvas missing')

const params = new URLSearchParams(location.search)
const stage = new Stage(canvas, { preserveDrawingBuffer: params.has('shot') })

// a dim house rig — only the rod and rings answer to it, the velvet lights itself
const key = new THREE.DirectionalLight(0xffe3d2, 1.35)
key.position.set(-3, 4, 5)
const rim = new THREE.DirectionalLight(0x8fa2ff, 0.45)
rim.position.set(4, 1, 2)
stage.scene.add(new THREE.AmbientLight(0x2a222c, 0.7), key, rim)

const curtains = new Curtains(stage)
// constructed first so its frame step runs before the background samples it
const fluid = new Fluid(stage)
const aurora = new Aurora(stage)
aurora.setWarpSource(fluid)
const dust = new Dust(stage)

// She may take longer to answer the permission bubble than the button takes to
// fade, so the promise itself is handed on rather than a settled value.
let mediaRequest: Promise<MediaOutcome> | null = null

const button = new StartButton({
  onPress: () => {
    // the candle needs camera and mic; asking now means no bubble later
    mediaRequest = requestStagePermissions()
  },
  onFinish: () => {
    // chapter 2 hooks in here — the timeline that opens on 1980
    window.dispatchEvent(new CustomEvent('experience:start', { detail: { media: mediaRequest } }))
  },
})

const timeline = buildOpening({ curtains, aurora, dust, button })

// dev affordances: ?fast skims the intro, ?t=6 freezes it at a moment, R replays
if (params.has('fast')) timeline.timeScale(3.2)
if (params.has('t')) timeline.pause(Number(params.get('t')) || 0)
if (params.has('shot')) {
  // settle, then halt the loop so a headless capture terminates
  let frames = 0
  stage.onFrame(() => {
    if (++frames > 20) stage.stop()
  })
}
// ?stir sweeps a synthetic cursor through the gas, for tuning the fluid
// without a hand on the mouse
if (params.has('stir')) {
  stage.onFrame((_dt, elapsed) => {
    const t = elapsed * 0.9
    fluid.movePointer(
      (0.5 + 0.32 * Math.sin(t)) * window.innerWidth,
      (0.5 + 0.26 * Math.sin(t * 1.7 + 1.1)) * window.innerHeight,
    )
  })
}

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r') timeline.restart()
})

window.addEventListener('experience:start', (e) => {
  console.info('[opening] complete — ready for the timeline')
  const detail = (e as CustomEvent<{ media: Promise<MediaOutcome> | null }>).detail
  void detail?.media?.then((outcome) => console.info('[media] camera + mic:', outcome))
})

stage.start()
