import gsap from 'gsap'

interface Handlers {
  /**
   * Runs synchronously inside the click, while the browser still counts it as a
   * user gesture. Permission requests have to live here — a second later, after
   * the fade, the gesture has expired in stricter browsers.
   */
  onPress?: () => void
  /** Runs once the button has faded out and the next chapter can take over. */
  onFinish: () => void
}

export class StartButton {
  readonly el: HTMLButtonElement
  private breath?: gsap.core.Tween

  constructor(private readonly handlers: Handlers) {
    const el = document.getElementById('start')
    if (!(el instanceof HTMLButtonElement)) throw new Error('#start button missing')
    this.el = el
    this.el.addEventListener('click', this.handleClick)
  }

  /** Returns a tween the master timeline can position precisely. */
  reveal(): gsap.core.Tween {
    return gsap.fromTo(
      this.el,
      { opacity: 0, scale: 0.94, filter: 'blur(6px)' },
      {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px)',
        duration: 2.4,
        ease: 'sine.out',
        onComplete: () => this.startBreathing(),
      },
    )
  }

  reset(): void {
    this.breath?.kill()
    this.breath = undefined
    gsap.set(this.el, { opacity: 0, scale: 0.94, filter: 'blur(6px)', pointerEvents: 'auto' })
  }

  private startBreathing(): void {
    this.breath = gsap.to(this.el, {
      scale: 1.018,
      duration: 3.4,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    })
  }

  private handleClick = (): void => {
    this.breath?.kill()
    gsap.set(this.el, { pointerEvents: 'none' })

    // before the tween, not after it: this is still the gesture
    this.handlers.onPress?.()

    gsap.to(this.el, {
      opacity: 0,
      scale: 1.08,
      filter: 'blur(8px)',
      duration: 1.0,
      ease: 'power2.inOut',
      onComplete: () => this.handlers.onFinish(),
    })
  }
}
