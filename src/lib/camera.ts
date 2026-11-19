export type Facing = 'environment' | 'user'

export function isSecureCameraContext(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.isSecureContext ||
    location.protocol === 'https:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1'
  )
}

export async function getCameraStream(facing: Facing): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera API unavailable')
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280 },
        height: { ideal: 960 },
        frameRate: { ideal: 24, max: 30 },
      },
    })
  } catch (error) {
    const name = (error as DOMException)?.name
    if (name === 'OverconstrainedError' || name === 'NotFoundError') {
      // Retry with the most permissive video constraint.
      return navigator.mediaDevices.getUserMedia({ audio: false, video: true })
    }
    throw error
  }
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function getVideoTrack(stream: MediaStream | null): MediaStreamTrack | null {
  return stream?.getVideoTracks()[0] ?? null
}

export function torchSupported(track: MediaStreamTrack | null): boolean {
  if (!track) return false
  const caps = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined
  return Boolean(caps?.torch)
}

export async function setTorch(track: MediaStreamTrack | null, on: boolean): Promise<boolean> {
  if (!track || !torchSupported(track)) return false
  try {
    await track.applyConstraints({
      advanced: [{ torch: on }],
    } as unknown as MediaTrackConstraints)
    return true
  } catch {
    return false
  }
}

export function captureVideoFrame(video: HTMLVideoElement): string | null {
  if (!video.videoWidth || !video.videoHeight) return null
  const maxDim = 1280
  const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight))
  const width = Math.round(video.videoWidth * scale)
  const height = Math.round(video.videoHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null
  context.drawImage(video, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export function cameraErrorMessage(error: unknown): 'denied' | 'notfound' | 'insecure' | 'unknown' {
  if (!isSecureCameraContext()) return 'insecure'
  const name = (error as DOMException)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'notfound'
  return 'unknown'
}
