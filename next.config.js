/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', 
  ...(process.env.DAVARA_DESKTOP_BUILD === "1" ? {
    webpack(config, { isServer }) {
      if (!isServer) config.plugins.push(new (require("./desktop/scripts/inventory.cjs").WebInventory)());
      return config;
    },
  } : {}),
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    domains: ["hebbkx1anhila5yf.public.blob.vercel-storage.com"],
    unoptimized: true,
  },
}

module.exports = nextConfig
