/** @type {import('next').NextConfig} */
const nextConfig = {
  // One self-contained server folder for the Docker image on the VM.
  output: 'standalone',
  images: { unoptimized: true },
  // The PDF library runs as plain Node code on the server (not bundled).
  serverExternalPackages: ['@react-pdf/renderer'],
  // PDFs draw the brand logos from public/brands with readFile. Vercel does not put public/
  // inside its server functions, so the logos are added to them here (16 KB).
  outputFileTracingIncludes: { '/**': ['./public/brands/**'] },
};

export default nextConfig;
