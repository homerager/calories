import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

function crc32(buf) {
  let crc = ~0
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function makePng(size, paint) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = paint(x, y, size)
      const i = row + 1 + x * 3
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const BG = [44, 111, 44]
const FG = [255, 255, 255]

function paintC(x, y, size, padding) {
  const cx = (size - 1) / 2
  const cy = (size - 1) / 2
  const content = size * (1 - 2 * padding)
  const outer = content * 0.36
  const inner = content * 0.2
  const dx = x - cx
  const dy = y - cy
  const dist = Math.hypot(dx, dy)
  const ang = Math.atan2(dy, dx)
  const inOpening = Math.abs(ang) < 0.72
  if (dist <= outer && dist >= inner && !inOpening) return FG
  return BG
}

mkdirSync(outDir, { recursive: true })

const files = {
  'pwa-192x192.png': makePng(192, (x, y, s) => paintC(x, y, s, 0.16)),
  'pwa-512x512.png': makePng(512, (x, y, s) => paintC(x, y, s, 0.16)),
  'pwa-512x512-maskable.png': makePng(512, (x, y, s) => paintC(x, y, s, 0.22)),
  'apple-touch-icon.png': makePng(180, (x, y, s) => paintC(x, y, s, 0.16)),
  'favicon-32.png': makePng(32, (x, y, s) => paintC(x, y, s, 0.12)),
}

for (const [name, buf] of Object.entries(files)) {
  writeFileSync(join(outDir, name), buf)
  console.log('wrote', name, buf.length, 'bytes')
}
