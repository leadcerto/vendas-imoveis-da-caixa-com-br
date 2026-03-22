import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/images/destaque/:slug.jpg',
        destination: '/images/destaque/base.jpg',
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'venda.imoveisdacaixa.com.br',
      },
    ],
    unoptimized: true, // Optional: if we want to bypass full optimization for now
  },
  output: 'standalone',
};

export default nextConfig;
