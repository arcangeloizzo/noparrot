/**
 * Server-side image dimensions parser.
 * Reads first ~20KB of an image via Range request, sniffs format (JPEG/PNG/GIF/WebP),
 * extracts width × height from header bytes.
 *
 * Deno-compatible. No external dependencies (no esm.sh/image-size for cold start).
 *
 * Used by step 2.2.b Edge Functions to classify orientation of link preview images.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Fetches first 20KB and parses dimensions. Returns null on failure (network, unknown format,
 * truncated header, etc.). Edge Functions should gracefully fallback to leaving fields NULL.
 */
export async function fetchImageDimensions(url: string): Promise<ImageDimensions | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const resp = await fetch(url, {
      headers: { 'Range': 'bytes=0-20480' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!resp.ok && resp.status !== 206) {
      console.warn(`[image-dimensions] fetch failed for ${url}: ${resp.status}`);
      return null;
    }
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 24) return null; // minimum header size for any format
    return parseImageDimensions(bytes);
  } catch (err) {
    console.error(`[image-dimensions] error for ${url}:`, err);
    return null;
  }
}

/**
 * Parse bytes synchronously. Exposed separately for testability.
 */
export function parseImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A | IHDR chunk | width @ 16-19 BE | height @ 20-23 BE
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
      && bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
    if (bytes.length < 24) return null;
    const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    return { width, height };
  }

  // JPEG: FF D8 ... seek SOF (Start Of Frame) marker
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    let offset = 2;
    while (offset < bytes.length - 9) {
      if (bytes[offset] !== 0xFF) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      // SOF markers: 0xC0-0xCF except 0xC4 (DHT), 0xC8 (JPG), 0xCC (DAC)
      if (marker >= 0xC0 && marker <= 0xCF
          && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        // SOF: FF Cx | segment size 2B | precision 1B | height 2B | width 2B
        if (offset + 8 >= bytes.length) return null;
        const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
        return { width, height };
      }
      // Skip current segment
      const size = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (size < 2) return null; // malformed
      offset += 2 + size;
    }
    return null;
  }

  // GIF: "GIF87a" or "GIF89a" | width @ 6-7 LE | height @ 8-9 LE
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46
      && bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) {
    if (bytes.length < 10) return null;
    const width = bytes[6] | (bytes[7] << 8);
    const height = bytes[8] | (bytes[9] << 8);
    return { width, height };
  }

  // WebP: "RIFF" ___ "WEBP" + VP8/VP8L/VP8X subformat
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    if (bytes.length < 30) return null;
    const fourCC = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (fourCC === 'VP8 ') {
      // VP8 lossy: width @ 26 + height @ 28 (14-bit LE, mask 0x3FFF)
      const width = ((bytes[26] | (bytes[27] << 8)) & 0x3FFF);
      const height = ((bytes[28] | (bytes[29] << 8)) & 0x3FFF);
      return { width, height };
    } else if (fourCC === 'VP8L') {
      // VP8L lossless: signature 0x2F at offset 20 | width-1 @ 21-22 (14-bit) | height-1 across 22-24
      if (bytes[20] !== 0x2F) return null;
      const b1 = bytes[21];
      const b2 = bytes[22];
      const b3 = bytes[23];
      const b4 = bytes[24];
      const width = ((b1 | (b2 << 8)) & 0x3FFF) + 1;
      const height = ((((b2 >> 6) | (b3 << 2) | ((b4 & 0x0F) << 10)) & 0x3FFF)) + 1;
      return { width, height };
    } else if (fourCC === 'VP8X') {
      // VP8X extended: width-1 @ 24-26 (3 bytes LE) + height-1 @ 27-29
      const width = (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1;
      const height = (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) + 1;
      return { width, height };
    }
    return null;
  }

  return null; // unknown format
}
