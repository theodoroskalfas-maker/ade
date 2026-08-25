import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this folder — silences the multi-lockfile warning
  // caused by an unrelated package-lock.json higher up in the user's home dir.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
