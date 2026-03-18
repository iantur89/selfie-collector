/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Skip TS check during Docker build (faster; run `npm run typecheck` in CI or locally)
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
