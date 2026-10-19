export default function sitemap() {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.etome24.hr').replace(/\/$/, '');

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
