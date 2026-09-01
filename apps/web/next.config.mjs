/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Base64 room photos + design specs comfortably exceed the 1MB default.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
