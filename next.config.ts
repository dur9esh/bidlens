import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The ingestion API routes read PDF files from /public/demo-bids/ at runtime
  // via `fs.readFile`. Next.js's automatic file tracing can't see those reads
  // (the filename is computed from the documentId param), so we explicitly
  // include the PDFs in the serverless bundle.
  outputFileTracingIncludes: {
    "/api/ingestions/[id]": ["./public/demo-bids/**/*"],
  },
};

export default nextConfig;
