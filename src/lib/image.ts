export interface CompressedImage {
  dataUrl: string
  bytes: number
  width: number
  height: number
}

const MAX_BYTES = 300 * 1024
const MAX_DIM = 1280

function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    let objectUrl: string | null = null
    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      resolve(img)
    }
    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read image'))
    }
    if (typeof source === 'string') {
      img.src = source
    } else {
      objectUrl = URL.createObjectURL(source)
      img.src = objectUrl
    }
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not compress image'))), 'image/jpeg', quality)
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Downscale to max 1280px and step JPEG quality down until the file is
 * comfortably under 300 KB (the upload budget for cheap mobile data).
 */
export async function compressImage(source: File | string): Promise<CompressedImage> {
  const img = await loadImage(source)
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height))
  let width = Math.max(1, Math.round(img.width * scale))
  let height = Math.max(1, Math.round(img.height * scale))

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not available')
    context.imageSmoothingQuality = 'high'
    context.drawImage(img, 0, 0, width, height)

    let quality = 0.82
    let blob = await canvasToBlob(canvas, quality)
    while (blob.size > MAX_BYTES && quality > 0.42) {
      quality -= 0.1
      blob = await canvasToBlob(canvas, quality)
    }

    if (blob.size <= MAX_BYTES || attempt === 4) {
      return { dataUrl: await blobToDataUrl(blob), bytes: blob.size, width, height }
    }

    width = Math.max(1, Math.round(width * 0.75))
    height = Math.max(1, Math.round(height * 0.75))
  }

  throw new Error('Could not compress image')
}
