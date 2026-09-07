export type MediaOutcome = 'granted' | 'denied' | 'unavailable'

/**
 * Asks for the camera and microphone at the one moment a browser will reliably
 * allow it: inside a real user gesture.
 *
 * The candle chapter needs both to see her blow it out. Asking there would put
 * a permission bubble in the middle of the most fragile moment of the whole
 * piece, so the ask happens here instead, on the one deliberate click she makes.
 *
 * Both tracks are stopped the instant permission is granted. Nothing is
 * recorded, stored or sent anywhere — this exists purely so the grant is
 * already in place. The browser remembers it for the origin, so the candle can
 * reopen the stream later without prompting again.
 *
 * Needs a secure context: https, or localhost during development.
 */
export async function requestStagePermissions(): Promise<MediaOutcome> {
  if (!navigator.mediaDevices?.getUserMedia) return 'unavailable'

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    for (const track of stream.getTracks()) track.stop()
    return 'granted'
  } catch {
    // she declined, or there is no camera. The journey continues either way.
    return 'denied'
  }
}
