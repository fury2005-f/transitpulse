/** @type {import('next').NextConfig} */
module.exports = {
  devIndicators: false,
  // The browser calls /api/* on the Next.js server, which forwards to FastAPI (no CORS, no hardcoded host in components).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.BACKEND_URL || "http://127.0.0.1:8000"}/api/:path*` }];
  },
};
