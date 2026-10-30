// Prepares a cover image in the browser before upload: crops to a square from the centre, shrinks big photos,
// and re-encodes as JPEG. Re-encoding also removes hidden photo metadata such as GPS location.
export const MIN_COVER_PX = 500
export const COVER_PX = 1400
const MAX_INPUT_BYTES = 25 * 1024 * 1024

type Loaded = { source: CanvasImageSource; width: number; height: number; release: () => void }

async function load(file: File): Promise<Loaded> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() }
    } catch { /* fall back to an <img> element below */ }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
  } catch {
    URL.revokeObjectURL(url)
    throw new Error('We could not read that image. Try a JPG, PNG or WebP file.')
  }
}

export async function prepareCover(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Use a JPG, PNG or WebP image.')
  if (file.size > MAX_INPUT_BYTES) throw new Error('That image is over 25 MB. Choose a smaller one.')
  const img = await load(file)
  try {
    const side = Math.min(img.width, img.height)
    if (side < MIN_COVER_PX) throw new Error(`Cover art must be at least ${MIN_COVER_PX} x ${MIN_COVER_PX} pixels.`)
    const out = Math.min(side, COVER_PX)
    const canvas = document.createElement('canvas')
    canvas.width = out; canvas.height = out
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Your browser could not process that image.')
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, out, out)
    ctx.drawImage(img.source, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, out, out)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not process that image.')), 'image/jpeg', 0.88))
  } finally { img.release() }
}
