import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Sunucuda (Coolify) Docker ile çalıştırmak için yalnızca gereken dosyaları paketle
  output: 'standalone',
  // Monorepo: packages/shared gibi apps/web dışındaki dosyalar da pakete girsin
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
