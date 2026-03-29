/**
 * Next.js configuration for running the app under a subpath (/ftp-server)
 * - basePath: sets the path the app is served from (client-side routing)
 * - assetPrefix: ensures static assets are requested under the same prefix
 */
module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath: '/ftp-server',
  assetPrefix: '/ftp-server',
  // If you need custom rewrites or redirects for the subpath, add them here.
};
