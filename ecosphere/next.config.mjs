/** @type {import('next').NextConfig} */
const nextConfig = {
  // Marketplace photos are validated server-side (max 2 MB); leave headroom for the form fields.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
