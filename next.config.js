/** @type {import('next').NextConfig} */
const basePath = process.env.BASE_PATH || '';

const nextConfig = {
  output: 'export',
  basePath,
  // Emit each route as <route>/index.html so static hosts (GitHub Pages, or a
  // plain `serve out`) resolve /simulator and /take-action without a 404.
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
