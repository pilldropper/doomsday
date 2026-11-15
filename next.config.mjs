/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep dev artifacts isolated from production builds so `next start` cannot
  // invalidate assets served by an active `next dev` process.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
