export const metadata = { title: 'EtoMe 24h', description: 'EtoMe – usluga dostupna 24/7' };

export default function RootLayout({ children }) {
  return <html lang="hr"><body style={{ margin: 0, fontFamily: 'Arial, sans-serif', background: '#f5f7f2' }}>{children}</body></html>;
}
