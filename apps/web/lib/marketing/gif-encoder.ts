/**
 * A small, dependency-free animated-GIF encoder (GIF89a + LZW).
 *
 * Frames are quantized to the 216-color web-safe cube (6×6×6) with a nearest-
 * level mapping, which keeps the encoder simple and correct without a median-cut
 * pass. Good enough for screen-capture GIFs; not a photographic quantizer.
 *
 * The LZW core follows the GIF variable-width-code spec and is verified by a
 * round-trip test (see gif-encoder.test.mjs).
 */

/** Build the 216-color web-safe palette padded to 256 entries. */
function webSafePalette(): number[][] {
  const levels = [0, 51, 102, 153, 204, 255]
  const pal: number[][] = []
  for (const r of levels) for (const g of levels) for (const b of levels) pal.push([r, g, b])
  while (pal.length < 256) pal.push([0, 0, 0])
  return pal
}

/** Map an 8-bit channel to its nearest web-safe level index (0..5). */
function levelIndex(v: number): number {
  return Math.min(5, Math.max(0, Math.round(v / 51)))
}

/** RGBA pixels → web-safe palette indices (one byte per pixel). */
function quantize(rgba: Uint8ClampedArray | Uint8Array, pixelCount: number): Uint8Array {
  const out = new Uint8Array(pixelCount)
  for (let i = 0; i < pixelCount; i++) {
    const r = rgba[i * 4]!
    const g = rgba[i * 4 + 1]!
    const b = rgba[i * 4 + 2]!
    out[i] = levelIndex(r) * 36 + levelIndex(g) * 6 + levelIndex(b)
  }
  return out
}

/** A growable little-endian byte sink. */
class ByteWriter {
  bytes: number[] = []
  u8(v: number) {
    this.bytes.push(v & 0xff)
  }
  u16(v: number) {
    this.bytes.push(v & 0xff, (v >> 8) & 0xff)
  }
  str(s: string) {
    for (let i = 0; i < s.length; i++) this.bytes.push(s.charCodeAt(i))
  }
  raw(arr: number[]) {
    for (const b of arr) this.bytes.push(b & 0xff)
  }
}

/** GIF LZW-encode palette indices → a flat array of data bytes (no sub-block
 *  framing; the caller chunks it). `minCodeSize` is 8 for a 256-color table. */
export function lzwEncode(indices: Uint8Array, minCodeSize: number): number[] {
  const clear = 1 << minCodeSize
  const eoi = clear + 1
  let codeSize = minCodeSize + 1
  let dict = new Map<string, number>()
  let next = eoi + 1

  const out: number[] = []
  let cur = 0
  let curBits = 0
  const emit = (code: number) => {
    cur |= code << curBits
    curBits += codeSize
    while (curBits >= 8) {
      out.push(cur & 0xff)
      cur >>= 8
      curBits -= 8
    }
  }

  const reset = () => {
    dict = new Map()
    next = eoi + 1
    codeSize = minCodeSize + 1
  }

  emit(clear)
  let prefix = String(indices[0])
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]!
    const combined = prefix + "," + k
    if (dict.has(combined)) {
      prefix = combined
    } else {
      emit(prefix.includes(",") ? dict.get(prefix)! : Number(prefix))
      dict.set(combined, next)
      if (next === (1 << codeSize) && codeSize < 12) codeSize++
      next++
      if (next > 4095) {
        emit(clear)
        reset()
      }
      prefix = String(k)
    }
  }
  emit(prefix.includes(",") ? dict.get(prefix)! : Number(prefix))
  emit(eoi)
  if (curBits > 0) out.push(cur & 0xff)
  return out
}

/** Split LZW output into ≤255-byte GIF sub-blocks, terminated by an empty one. */
function subBlocks(data: number[]): number[] {
  const out: number[] = []
  for (let i = 0; i < data.length; i += 255) {
    const chunk = data.slice(i, i + 255)
    out.push(chunk.length, ...chunk)
  }
  out.push(0)
  return out
}

export type GifFrame = { rgba: Uint8ClampedArray | Uint8Array; delayMs: number }

/**
 * Encode frames (all the same width/height) into a looping GIF89a. Returns the
 * raw bytes; wrap in a Blob with type "image/gif" to download.
 */
export function encodeGif(frames: GifFrame[], width: number, height: number): Uint8Array {
  const w = new ByteWriter()
  const palette = webSafePalette()

  // Header + logical screen descriptor (256-color global table).
  w.str("GIF89a")
  w.u16(width)
  w.u16(height)
  w.u8(0xf7) // GCT present, color res 8, GCT size = 256
  w.u8(0)
  w.u8(0)
  for (const [r, g, b] of palette) w.raw([r!, g!, b!])

  // Netscape looping extension (loop forever).
  w.raw([0x21, 0xff, 0x0b])
  w.str("NETSCAPE2.0")
  w.raw([0x03, 0x01, 0x00, 0x00, 0x00])

  for (const frame of frames) {
    const delay = Math.max(2, Math.round(frame.delayMs / 10)) // GIF delay is in 1/100 s
    w.raw([0x21, 0xf9, 0x04, 0x00, delay & 0xff, (delay >> 8) & 0xff, 0x00, 0x00])
    // Image descriptor.
    w.u8(0x2c)
    w.u16(0)
    w.u16(0)
    w.u16(width)
    w.u16(height)
    w.u8(0)
    // LZW image data.
    const indices = quantize(frame.rgba, width * height)
    w.u8(8) // min code size
    w.raw(subBlocks(lzwEncode(indices, 8)))
  }

  w.u8(0x3b) // trailer
  return Uint8Array.from(w.bytes)
}
