import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@orbit/shared'],
  // Lint runs through the workspace `lint` script (eslint src); keep builds deterministic.
  eslint: { ignoreDuringBuilds: true },
};

export default withNextIntl(config);
