const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.etome24.hr').replace(/\/$/, '');

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'EtoMe24h | Tu smo kad treba',
  description: 'EtoMe24h – rušenja, šut, čišćenje, dvorišta, brodovi, pranje i selidbe u Splitu i Dalmaciji.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'EtoMe24h | Tu smo kad treba',
    description: 'EtoMe24h – usluge u Splitu i Dalmaciji.',
    type: 'website',
    url: SITE_URL,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="hr">
      <body style={{ margin: 0, fontFamily: 'Arial, sans-serif', background: '#0b0b0b' }}>
        {children}
      </body>
    </html>
  );
}
