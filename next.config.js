/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  compress: true,
  poweredByHeader: false,
  reactStrictMode: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
      allowedOrigins: [
        '*.run.app',
        '*.aistudio.google.com',
        '*.google.com',
        '*.googleusercontent.com',
        'localhost:3000',
        '127.0.0.1:3000',
      ],
    },
  },
  allowedDevOrigins: [
    '*.run.app',
    '*.aistudio.google.com',
    '*.google.com',
    '*.googleusercontent.com',
    'localhost:3000',
    '127.0.0.1:3000',
  ],
  serverExternalPackages: ['better-sqlite3'],
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.devtool = false;
      config.optimization.minimize = false;
    }
    return config;
  },
};

module.exports = nextConfig;

