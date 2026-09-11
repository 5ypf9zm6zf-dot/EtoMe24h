export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://etome24.hr'),
  title: 'EtoMe24h | Tu smo kad treba',
  description: 'EtoMe24h – rušenja, šut, čišćenje, dvorišta, brodovi, pranje i selidbe u Splitu i Dalmaciji.',
  openGraph: {
    title: 'EtoMe24h | Tu smo kad treba',
    description: 'EtoMe24h – usluge u Splitu i Dalmaciji.',
    type: 'website',
    url: 'https://etome24.hr',
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
