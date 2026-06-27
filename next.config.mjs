/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/week',            destination: '/all-tasks', permanent: false },
      { source: '/calendar',        destination: '/all-tasks', permanent: false },
      { source: '/groups',          destination: '/task-type', permanent: false },
      { source: '/activity',        destination: '/activity-review', permanent: false },
      { source: '/review',          destination: '/activity-review', permanent: false },
      { source: '/search',          destination: '/', permanent: false },
    ];
  },
};

export default nextConfig;
