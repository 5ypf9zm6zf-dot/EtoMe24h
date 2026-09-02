export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://etome24h.vercel.app'),
  title: 'EtoMe24h | Tu smo kad treba',
  description: 'EtoMe24h – brze i pouzdane usluge dostupne 24 sata dnevno.',
  openGraph: {
    title: 'EtoMe24h | Tu smo kad treba',
    description: 'EtoMe24h – brze i pouzdane usluge dostupne 24 sata dnevno.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="hr">
      <body style={{ margin: 0, fontFamily: 'Arial, sans-serif', background: '#f5f7f2' }}>
        {children}
      </body>
    </html>
  );
}
