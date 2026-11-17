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
