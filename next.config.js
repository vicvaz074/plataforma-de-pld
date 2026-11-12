/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', 
  reactStrictMode: true,
  swcMinify: true,
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
