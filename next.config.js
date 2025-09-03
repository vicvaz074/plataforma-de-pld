/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ["hebbkx1anhila5yf.public.blob.vercel-storage.com"],
    unoptimized: true,
  },
  experimental: {
    // Desactivar experimentos que puedan causar problemas
    serverComponentsExternalPackages: [],
  },
  // Asegurarse de que webpack no cause problemas
  webpack: (config) => {
    return config
  },
}

module.exports = nextConfig
