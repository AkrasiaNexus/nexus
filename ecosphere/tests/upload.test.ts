import { describe, expect, it } from "vitest";
import { checkImage, sniffImage, MAX_IMAGE_BYTES, stripMetadata } from "@/lib/upload";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
const html = new TextEncoder().encode("<html><script>alert(1)</script>");

describe("image upload checks", () => {
  it("recognises real image signatures", () => {
    expect([sniffImage(png), sniffImage(jpeg), sniffImage(webp)]).toEqual(["image/png", "image/jpeg", "image/webp"]);
  });
  it("rejects a file whose bytes don't match its claimed type", () => {
    expect(checkImage(html, "image/png")).toEqual({ error: "Photo must be a JPEG, PNG or WebP image." });
    expect(checkImage(png, "image/jpeg")).toHaveProperty("error");
  });
  it("rejects oversized files and accepts valid ones", () => {
    expect(checkImage(new Uint8Array(MAX_IMAGE_BYTES + 1), "image/jpeg")).toHaveProperty("error");
    expect(checkImage(png, "image/png")).toEqual({ type: "image/png" });
  });
});

describe("stripMetadata", () => {
  const seg = (marker: number, body: number[]) => [0xff, marker, 0, body.length + 2, ...body];
  it("removes JPEG EXIF (APP1) and comments but keeps JFIF and image data", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, ...seg(0xe0, [74, 70]), ...seg(0xe1, [69, 120, 105, 102]), ...seg(0xfe, [1]), 0xff, 0xda, 9, 9, 0xff, 0xd9]);
    expect(Array.from(stripMetadata(jpeg, "image/jpeg")!)).toEqual([0xff, 0xd8, ...seg(0xe0, [74, 70]), 0xff, 0xda, 9, 9, 0xff, 0xd9]);
  });
  it("removes PNG eXIf/tEXt chunks and keeps the rest", () => {
    const chunk = (name: string, data: number[]) => [0, 0, 0, data.length, ...Array.from(name, (c) => c.charCodeAt(0)), ...data, 1, 2, 3, 4];
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const png = new Uint8Array([...sig, ...chunk("IHDR", [7]), ...chunk("eXIf", [8, 8]), ...chunk("tEXt", [9]), ...chunk("IDAT", [5]), ...chunk("IEND", [])]);
    expect(Array.from(stripMetadata(png, "image/png")!)).toEqual([...sig, ...chunk("IHDR", [7]), ...chunk("IDAT", [5]), ...chunk("IEND", [])]);
  });
  it("removes WebP EXIF, clears the VP8X flag and fixes the RIFF size", () => {
    const chunk = (name: string, data: number[]) => [...Array.from(name, (c) => c.charCodeAt(0)), data.length, 0, 0, 0, ...data];
    const riff = (body: number[]) => [82, 73, 70, 70, body.length + 4, 0, 0, 0, 87, 69, 66, 80, ...body];
    const webp = new Uint8Array(riff([...chunk("VP8X", [0x08, 0, 0, 0, 0, 0, 0, 0, 0, 0]), ...chunk("VP8 ", [1, 2]), ...chunk("EXIF", [3, 4])]));
    expect(Array.from(stripMetadata(webp, "image/webp")!)).toEqual(riff([...chunk("VP8X", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), ...chunk("VP8 ", [1, 2])]));
  });
  it("rejects truncated files", () => {
    expect(stripMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x10, 0x00]), "image/jpeg")).toBeNull();
  });
});
