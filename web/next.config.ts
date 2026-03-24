import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [];
  },
  async rewrites() {
    return [
      {
        source: '/index.html',
        destination: '/',
      },
      {
        source: '/dashboard.html',
        destination: '/dashboard',
      },
      {
        source: '/site-login.html',
        destination: '/site-login',
      },
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
