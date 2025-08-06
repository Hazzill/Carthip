/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'lh5.googleusercontent.com',
          port: '',
          pathname: '/**',
        },
        {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'profile.line-scdn.net',
        port: '',
        pathname: '/**',
      },
        // คุณสามารถเพิ่ม hostname อื่นๆ ที่นี่ได้
      ],
    },
  };
  
  export default nextConfig;
