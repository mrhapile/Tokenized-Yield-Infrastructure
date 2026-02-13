import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  // Optimize heavy Solana packages
  experimental: {
    optimizePackageImports: [
      '@solana/web3.js',
      '@coral-xyz/anchor',
      '@solana/wallet-adapter-react',
      '@solana/wallet-adapter-react-ui',
      'lucide-react',
    ],
  },

  // Webpack configuration for Solana compatibility
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Polyfill for crypto in browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        stream: false,
        buffer: false,
      };
    }
    return config;
  },
}

export default nextConfig
