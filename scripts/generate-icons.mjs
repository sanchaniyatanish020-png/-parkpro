import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const NAVY = '#0B1F3A'
const NAVY_2 = '#112A4A'

const pGlyph = `
  <path fill="${NAVY}" fill-rule="evenodd" d="M352 320h158c98 0 162 62 162 150s-64 150-162 150h-62v90H352V320Zm96 92v116h64c40 0 60-24 60-58s-20-58-60-58h-64Z"/>
`

function iconSvg({ size = 1024, tile = 600, rx = 168, glow = true } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${NAVY}"/>
      <stop offset="1" stop-color="${NAVY_2}"/>
    </linearGradient>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFC61F"/>
      <stop offset="1" stop-color="#FFB400"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#FFB400" stop-opacity="0.30"/>
      <stop offset="1" stop-color="#FFB400" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  ${glow ? '<circle cx="512" cy="512" r="470" fill="url(#glow)"/>' : ''}
  <rect x="${512 - tile / 2}" y="${512 - tile / 2}" width="${tile}" height="${tile}" rx="${rx}" fill="url(#tile)"/>
  ${pGlyph}
</svg>`
}

function splashSvg(w, h) {
  const logo = Math.round(Math.min(w, h) * 0.3)
  const x = (w - logo) / 2
  const y = (h - logo) / 2 - Math.min(w, h) * 0.03
  const lineW = Math.round(logo * 0.34)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${NAVY}"/>
      <stop offset="1" stop-color="${NAVY_2}"/>
    </linearGradient>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFC61F"/>
      <stop offset="1" stop-color="#FFB400"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <circle cx="${w / 2}" cy="${y + logo / 2}" r="${logo * 0.78}" fill="#FFB400" opacity="0.08"/>
  <g transform="translate(${x} ${y}) scale(${logo / 1024})">
    <rect x="212" y="212" width="600" height="600" rx="168" fill="url(#tile)"/>
    ${pGlyph}
  </g>
  <rect x="${(w - lineW) / 2}" y="${y + logo + logo * 0.16}" width="${lineW}" height="${Math.max(4, Math.round(logo * 0.035))}" rx="4" fill="#FFB400" opacity="0.9"/>
</svg>`
}

await mkdir('public/icons', { recursive: true })
await mkdir('public/splash', { recursive: true })

const tasks = [
  [iconSvg(), 'public/icons/icon-512.png', 512],
  [iconSvg(), 'public/icons/icon-192.png', 192],
  [iconSvg({ tile: 480, rx: 140 }), 'public/icons/maskable-512.png', 512],
  [iconSvg({ tile: 540, rx: 150, glow: false }), 'public/icons/apple-touch-icon.png', 180],
]

for (const [svg, out, size] of tasks) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(out)
}

const splashes = [
  [1170, 2532], [1179, 2556], [1284, 2778], [1290, 2796],
  [1125, 2436], [828, 1792], [1242, 2688], [750, 1334],
  [1536, 2048], [1668, 2388], [2048, 2732],
]
for (const [w, h] of splashes) {
  await sharp(Buffer.from(splashSvg(w, h))).png({ compressionLevel: 9 }).toFile(`public/splash/splash-${w}x${h}.png`)
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC61F"/><stop offset="1" stop-color="#FFB400"/></linearGradient></defs>
  <rect width="1024" height="1024" rx="220" fill="${NAVY}"/>
  <rect x="132" y="132" width="760" height="760" rx="190" fill="url(#t)"/>
  ${pGlyph}
</svg>`
await sharp(Buffer.from(favicon)).resize(32, 32).png().toFile('public/favicon-32.png')
await sharp(Buffer.from(favicon)).resize(180, 180).png().toFile('public/icons/favicon-180.png')

console.log('Icons and splash screens generated.')
