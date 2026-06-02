import { createPage } from './boardPages'

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

export function loadImageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = dataUrl
  })
}

/** Scale image to fit inside canvas with margin; centered. */
export function fitImageOnCanvas(naturalW, naturalH, canvasW, canvasH, margin = 80) {
  const maxW = Math.max(1, canvasW - margin * 2)
  const maxH = Math.max(1, canvasH - margin * 2)
  const scale = Math.min(maxW / naturalW, maxH / naturalH, 1)
  const w = Math.round(naturalW * scale)
  const h = Math.round(naturalH * scale)
  return {
    x: Math.round((canvasW - w) / 2),
    y: Math.round((canvasH - h) / 2),
    w,
    h,
  }
}

export function pageNameFromFile(file, index) {
  const base = file.name.replace(/\.[^.]+$/i, '').trim()
  return base || `Slide ${index + 1}`
}

export function filterPngFiles(fileList) {
  return [...fileList].filter(
    f => f.type === 'image/png' || /\.png$/i.test(f.name),
  ).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

/**
 * @param {FileList | File[]} files
 * @param {{ createId: () => string, canvasWidth: number, canvasHeight: number }} opts
 * @returns {Promise<import('./boardPages').BoardPage[]>}
 */
export async function buildPagesFromPngFiles(files, { createId, canvasWidth, canvasHeight }) {
  const pngs = filterPngFiles(files)
  if (!pngs.length) return []

  const pages = []
  for (let i = 0; i < pngs.length; i++) {
    const file = pngs[i]
    const url = await readFileAsDataUrl(file)
    const { width, height } = await loadImageDimensions(url)
    const { x, y, w, h } = fitImageOnCanvas(width, height, canvasWidth, canvasHeight)
    const image = { id: createId(), x, y, url, w, h }
    pages.push(
      createPage(createId(), pageNameFromFile(file, i), {
        strokes: [],
        stickies: [],
        text_boxes: [],
        shapes: [],
        images: [image],
      }),
    )
  }
  return pages
}
