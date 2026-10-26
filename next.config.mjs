/** @type {import('next').NextConfig} */
const nextConfig = {
  // One self-contained server folder for the Docker image on the VM.
  output: 'standalone',
  images: { unoptimized: true },
};

export default nextConfig;
