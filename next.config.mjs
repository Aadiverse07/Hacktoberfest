/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // typedRoutes was removed: Link hrefs in Home/menus are plain strings, which `next build` rejects under typedRoutes.
};
export default nextConfig;
