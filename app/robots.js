export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://etome24h.vercel.app';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
