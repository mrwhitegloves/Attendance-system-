/** @type {import('next').NextConfig} */
const nextConfig = {
  // One self-contained server folder for the Docker image on the VM.
  output: 'standalone',
  images: { unoptimized: true },
  // The PDF library runs as plain Node code on the server (not bundled).
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
