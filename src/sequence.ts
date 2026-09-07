import gsap from 'gsap'
import type { Curtains } from './scene/curtains'
import type { Aurora } from './scene/aurora'
import type { Dust } from './scene/dust'
import type { StartButton } from './ui/startButton'

interface Parts {
  curtains: Curtains
  aurora: Aurora
  dust: Dust
  button: StartButton
}

/**
 * The opening beat, start to finish. Times are absolute seconds on the master
 * timeline so each moment can be nudged without disturbing its neighbours.
 */
export function buildOpening({ curtains, aurora, dust, button }: Parts): gsap.core.Timeline {
  const tl = gsap.timeline()

  // the house sits closed, breathing, for a beat
  tl.set(curtains, { open: 0, dim: 0 }, 0)
  tl.set(aurora, { opacity: 0 }, 0)
  tl.set(dust, { opacity: 0 }, 0)
  tl.add(() => button.reset(), 0)

  // anticipation: the panels take up the slack before they move
  tl.to(curtains, {
    open: -0.014,
    duration: 0.55,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: 1,
  }, 1.7)

  // the draw itself — long, weighted, never linear
  tl.to(curtains, { open: 1, duration: 6.8, ease: 'power2.inOut' }, 2.9)

  // stage light dies on the fabric as it clears frame, leaving a dark proscenium
  tl.to(curtains, { dim: 1, duration: 3.4, ease: 'sine.in' }, 6.6)

  // the black is held bare for a moment before the light arrives
  tl.to(aurora, { opacity: 1, duration: 5.2, ease: 'sine.out' }, 7.2)
  tl.to(dust, { opacity: 1, duration: 3.4, ease: 'sine.out' }, 8.8)

  tl.add(button.reveal(), 10.6)

  return tl
}
