import { describe, expect, it } from "vitest";
import { checkImage, sniffImage, MAX_IMAGE_BYTES } from "@/lib/upload";

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
