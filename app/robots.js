export default function robots() {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.etome24.hr').replace(/\/$/, '');

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
