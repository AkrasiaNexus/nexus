// Image uploads: trust the file's bytes, not the browser's claimed type.
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
type ImageType = keyof typeof IMAGE_TYPES;

export function sniffImage(bytes: Uint8Array): ImageType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const ascii = (a: number, b: number) => String.fromCharCode(...Array.from(bytes.slice(a, b)));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

// Returns the verified type, or an error message for the user.
export function checkImage(bytes: Uint8Array, claimedType: string): { type: ImageType } | { error: string } {
  if (bytes.byteLength > MAX_IMAGE_BYTES) return { error: "Photo must be 2 MB or smaller." };
  const type = sniffImage(bytes);
  if (!type || type !== claimedType) return { error: "Photo must be a JPEG, PNG or WebP image." };
  return { type };
}

// Drop metadata (EXIF incl. GPS, XMP, comments, text chunks) so public photos can't reveal where they were taken.
// Returns null if the container is malformed; callers reject the upload.
export function stripMetadata(bytes: Uint8Array, type: ImageType): Uint8Array | null {
  const parts: Uint8Array[] = [];
  const out = () => { const r = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); parts.reduce((o, p) => (r.set(p, o), o + p.length), 0); return r; };
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === "image/jpeg") {
    parts.push(bytes.subarray(0, 2));
    for (let i = 2; i + 4 <= bytes.length; ) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      if (marker === 0xda) return parts.push(bytes.subarray(i)), out(); // start of scan: rest is image data
      const end = i + 2 + v.getUint16(i + 2);
      if (end > bytes.length) return null;
      if (!((marker >= 0xe1 && marker <= 0xef) || marker === 0xfe)) parts.push(bytes.subarray(i, end)); // keep all but APP1–15, COM
      i = end;
    }
    return null;
  }
  if (type === "image/png") {
    const DROP = ["eXIf", "tEXt", "zTXt", "iTXt", "tIME"];
    parts.push(bytes.subarray(0, 8));
    for (let i = 8; i + 12 <= bytes.length; ) {
      const end = i + 12 + v.getUint32(i);
      if (end > bytes.length) return null;
      const name = String.fromCharCode(...Array.from(bytes.subarray(i + 4, i + 8)));
      if (!DROP.includes(name)) parts.push(bytes.subarray(i, end));
      if (name === "IEND") return out();
      i = end;
    }
    return null;
  }
  // WebP (RIFF): drop EXIF/XMP chunks, clear their VP8X flags, fix the RIFF size.
  parts.push(bytes.slice(0, 12));
  for (let i = 12; i + 8 <= bytes.length; ) {
    const size = v.getUint32(i + 4, true);
    const end = i + 8 + size + (size & 1);
    if (end > bytes.length) return null;
    const name = String.fromCharCode(...Array.from(bytes.subarray(i, i + 4)));
    if (name === "VP8X") { const c = bytes.slice(i, end); c[8] &= ~0x0c; parts.push(c); }
    else if (name !== "EXIF" && name !== "XMP ") parts.push(bytes.subarray(i, end));
    i = end;
  }
  const r = out();
  new DataView(r.buffer).setUint32(4, r.length - 8, true);
  return r;
}
