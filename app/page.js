'use client';

import { useEffect, useState } from 'react';

const CONTACT = {
  phone: '+385981947591',
  displayPhone: '098 1947 591',
  email: 'etome.24h@gmail.com',
  whatsapp: 'https://wa.me/385981947591',
};

const categories = ['Sve', 'Rušenja', 'Šut & odvoz', 'Čišćenje', 'Dvorište', 'Brod & wash', 'Selidbe'];

const services = [
  { title: 'Rušenja', description: 'Stanovi, kupaonice, zidovi i štemanje.', image: '/slike/rusenja.svg', alt: 'Ilustracija rušenja i uklanjanja zidova' },
  { title: 'Šut & odvoz', description: 'Odvoz šute i otpada – toboganom direkt u kombi.', image: '/slike/sut-odvoz.svg', alt: 'Ilustracija odvoza šute kombijem' },
  { title: 'Čišćenje', description: 'Stanovi i prostori spremni za majstore.', image: '/slike/ciscenje.svg', alt: 'Ilustracija čišćenja prostora' },
  { title: 'Dvorište', description: 'Košnja, krčenje, okućnice, maslinici i dvorišta.', image: '/slike/dvoriste.svg', alt: 'Ilustracija uređenog zelenog dvorišta' },
  { title: 'Brod & wash', description: 'Peremo brode, kamen, bazen i sve što trpi pranje.', image: '/slike/brod-wash.svg', alt: 'Ilustracija broda na moru' },
  { title: 'Selidbe', description: 'Namještaj, stvari i odvoz bez filozofije.', image: '/slike/selidbe.svg', alt: 'Ilustracija kutija za selidbu' },
];

const actionStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 48,
  borderRadius: 12,
  padding: '12px 14px',
  textDecoration: 'none',
  fontWeight: 900,
  textAlign: 'center',
};

export default function Home() {
  const [active, setActive] = useState('Sve');
  const [selectedService, setSelectedService] = useState(null);

  useEffect(() => {
    if (!selectedService) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedService(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedService]);

  const visible = active === 'Sve' ? services : services.filter((service) => service.title === active);

  return (
    <main style={{ minHeight: '100vh', background: '#0b0b0b', color: '#fff' }}>
      <header style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ fontWeight: 950, fontSize: 28, letterSpacing: -1.5 }}>EtoMe<span style={{ color: '#ffd400' }}>24h</span></div>
        <a href={`tel:${CONTACT.phone}`} style={{ color: '#0b0b0b', background: '#ffd400', textDecoration: 'none', padding: '11px 17px', borderRadius: 999, fontWeight: 900, whiteSpace: 'nowrap' }}>📞 {CONTACT.displayPhone}</a>
      </header>

      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 20px 42px' }}>
        <div style={{ display: 'inline-block', padding: '7px 12px', border: '1px solid #ffd400', borderRadius: 999, color: '#ffd400', fontWeight: 800, marginBottom: 18 }}>SPLIT • DALMACIJA</div>
        <h1 style={{ fontSize: 'clamp(44px, 8vw, 86px)', lineHeight: .92, letterSpacing: -4, margin: 0, maxWidth: 900 }}>NEMA ČEKANJA.<br /><span style={{ color: '#ffd400' }}>NEMA IZGOVORA.</span></h1>
        <p style={{ fontSize: 21, color: '#c9c9c9', maxWidth: 650, lineHeight: 1.5 }}>Rušenja, šut, čišćenje, dvorišta, brodovi, pranje i selidbe. Jedan poziv i krećemo.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 26 }}>
          <a href={`tel:${CONTACT.phone}`} style={{ background: '#ffd400', color: '#111', textDecoration: 'none', padding: '15px 22px', borderRadius: 12, fontWeight: 950 }}>POZOVI ETO.ME →</a>
          <a href="https://etome.app/register" target="_blank" rel="noopener noreferrer" style={{ background: '#fff', color: '#111', textDecoration: 'none', padding: '15px 22px', borderRadius: 12, fontWeight: 900 }}>📱 ETO.ME APP →</a>
        </div>
      </section>

      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '15px 20px 70px' }}>
        <h2 style={{ fontSize: 30, margin: '0 0 18px', letterSpacing: -1 }}>Što triba napravit?</h2>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 18 }}>
          {categories.map((category) => (
            <button key={category} onClick={() => setActive(category)} style={{ whiteSpace: 'nowrap', border: active === category ? '2px solid #ffd400' : '1px solid #444', background: active === category ? '#ffd400' : '#151515', color: active === category ? '#111' : '#fff', padding: '10px 14px', borderRadius: 999, fontWeight: 800, cursor: 'pointer' }}>{category}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 16 }}>
          {visible.map((service) => (
            <button key={service.title} type="button" onClick={() => setSelectedService(service)} aria-label={`Otvori detalje: ${service.title}`} style={{ display: 'block', textAlign: 'left', padding: 0, overflow: 'hidden', cursor: 'pointer', background: '#151515', color: '#fff', border: '1px solid #303030', borderRadius: 18 }}>
              <img src={service.image} alt={service.alt} loading="lazy" style={{ display: 'block', width: '100%', height: 185, objectFit: 'cover', background: '#202020' }} />
              <div style={{ padding: '18px 20px 20px' }}>
                <div style={{ color: '#ffd400', fontWeight: 950, fontSize: 19 }}>{service.title}</div>
                <p style={{ color: '#bdbdbd', lineHeight: 1.5, margin: '9px 0 14px' }}>{service.description}</p>
                <span style={{ color: '#ffd400', fontWeight: 900 }}>Detalji i kontakt →</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedService && (
        <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedService(null); }} style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(6px)' }}>
          <section role="dialog" aria-modal="true" aria-labelledby="service-modal-title" style={{ width: 'min(100%, 620px)', maxHeight: 'min(92vh, 850px)', overflowY: 'auto', background: '#151515', color: '#fff', border: '1px solid #393939', borderRadius: 22, boxShadow: '0 25px 90px rgba(0,0,0,.65)' }}>
            <div style={{ position: 'relative' }}>
              <img src={selectedService.image} alt={selectedService.alt} style={{ display: 'block', width: '100%', height: 340, objectFit: 'cover', background: '#222' }} />
              <button type="button" onClick={() => setSelectedService(null)} aria-label="Zatvori detalje" style={{ position: 'absolute', top: 12, right: 12, width: 42, height: 42, border: 0, borderRadius: 999, background: '#111', color: '#fff', fontSize: 28, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: 22 }}>
              <h2 id="service-modal-title" style={{ color: '#ffd400', fontSize: 30, margin: '0 0 10px' }}>{selectedService.title}</h2>
              <p style={{ color: '#ddd', lineHeight: 1.65, fontSize: 17, margin: '0 0 20px' }}>{selectedService.description} Svaki posao procjenjujemo pojedinačno. Pošalji nam upit i dogovorit ćemo detalje.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                <a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer" style={{ ...actionStyle, background: '#25d366', color: '#07180c' }}>WhatsApp</a>
                <a href={`mailto:${CONTACT.email}`} style={{ ...actionStyle, background: '#ffd400', color: '#111' }}>E-mail</a>
                <a href={`tel:${CONTACT.phone}`} style={{ ...actionStyle, background: '#fff', color: '#111' }}>Poziv · {CONTACT.displayPhone}</a>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
