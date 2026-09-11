'use client';

import { useState } from 'react';

const categories = ['Sve', 'Rušenja', 'Šut & odvoz', 'Čišćenje', 'Dvorište', 'Brod & wash', 'Selidbe'];
const services = [
  ['Rušenja', 'Stanovi, kupaonice, zidovi i štemanje.'],
  ['Šut & odvoz', 'Odvoz šute i otpada – toboganom direkt u kombi.'],
  ['Čišćenje', 'Stanovi i prostori spremni za majstore.'],
  ['Dvorište', 'Košnja, krčenje, okućnice, maslinici i dvorišta.'],
  ['Brod & wash', 'Peremo brode, kamen, bazen i sve što trpi pranje.'],
  ['Selidbe', 'Namještaj, stvari i odvoz bez filozofije.'],
];

export default function Home() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('Sve');
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Bok! 👋 Ja sam EtoMe AI. Reci što ti treba i složit ćemo rješenje.' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next); setInput(''); setLoading(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next }) });
      const data = await res.json();
      setMessages([...next, { role: 'assistant', content: data.reply || 'Trenutno ne mogu odgovoriti.' }]);
    } catch { setMessages([...next, { role: 'assistant', content: 'Ups — trenutno sam nedostupan. Nazovi nas direktno.' }]); }
    finally { setLoading(false); }
  }

  const visible = active === 'Sve' ? services : services.filter(([name]) => name === active);

  return <main style={{ minHeight: '100vh', background: '#0b0b0b', color: '#fff' }}>
    <header style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ fontWeight: 950, fontSize: 28, letterSpacing: -1.5 }}>EtoMe<span style={{ color: '#ffd400' }}>24h</span></div>
      <a href="tel:+385981947591" style={{ color: '#0b0b0b', background: '#ffd400', textDecoration: 'none', padding: '11px 17px', borderRadius: 999, fontWeight: 900 }}>📞 098 1947 591</a>
    </header>
    <section style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 20px 42px' }}>
      <div style={{ display: 'inline-block', padding: '7px 12px', border: '1px solid #ffd400', borderRadius: 999, color: '#ffd400', fontWeight: 800, marginBottom: 18 }}>SPLIT • DALMACIJA</div>
      <h1 style={{ fontSize: 'clamp(44px, 8vw, 86px)', lineHeight: .92, letterSpacing: -4, margin: 0, maxWidth: 900 }}>NEMA ČEKANJA.<br/><span style={{ color: '#ffd400' }}>NEMA IZGOVORA.</span></h1>
      <p style={{ fontSize: 21, color: '#c9c9c9', maxWidth: 650, lineHeight: 1.5 }}>Rušenja, šut, čišćenje, dvorišta, brodovi, pranje i selidbe. Jedan poziv i krećemo.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 26 }}>
        <a href="tel:+385981947591" style={{ background: '#ffd400', color: '#111', textDecoration: 'none', padding: '15px 22px', borderRadius: 12, fontWeight: 950 }}>POZOVI ETO.ME →</a>
        <button onClick={() => setOpen(true)} style={{ background: '#fff', color: '#111', border: 0, padding: '15px 22px', borderRadius: 12, fontWeight: 900, cursor: 'pointer' }}>🤖 PITAJ ETO.ME AI</button>
      </div>
    </section>
    <section style={{ maxWidth: 1100, margin: '0 auto', padding: '15px 20px 70px' }}>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 18 }}>{categories.map(c => <button key={c} onClick={() => setActive(c)} style={{ whiteSpace: 'nowrap', border: active === c ? '2px solid #ffd400' : '1px solid #444', background: active === c ? '#ffd400' : '#151515', color: active === c ? '#111' : '#fff', padding: '10px 14px', borderRadius: 999, fontWeight: 800, cursor: 'pointer' }}>{c}</button>)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>{visible.map(([name, text]) => <article key={name} style={{ background: '#151515', border: '1px solid #2d2d2d', borderRadius: 18, padding: 22 }}><div style={{ color: '#ffd400', fontWeight: 950, fontSize: 18 }}>{name}</div><p style={{ color: '#bdbdbd', lineHeight: 1.5 }}>{text}</p><a href="tel:+385981947591" style={{ color: '#fff', fontWeight: 800 }}>Nazovi →</a></article>)}</div>
    </section>
    {open && <div style={{ position: 'fixed', right: 18, bottom: 18, width: 'min(400px, calc(100vw - 36px))', height: 580, background: '#fff', color: '#111', borderRadius: 20, boxShadow: '0 20px 70px rgba(0,0,0,.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 10 }}>
      <header style={{ background: '#111', color: '#ffd400', padding: 16, display: 'flex', justifyContent: 'space-between', fontWeight: 950 }}><span>🤖 EtoMe AI</span><button onClick={() => setOpen(false)} style={{ background: 'none', color: '#fff', border: 0, fontSize: 22, cursor: 'pointer' }}>×</button></header>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>{messages.map((m, i) => <div key={i} style={{ margin: '8px 0', textAlign: m.role === 'user' ? 'right' : 'left' }}><span style={{ display: 'inline-block', maxWidth: '85%', padding: '10px 13px', borderRadius: 14, background: m.role === 'user' ? '#fff0a8' : '#eee' }}>{m.content}</span></div>)}{loading && <div style={{ color: '#777' }}>EtoMe AI razmišlja…</div>}</div>
      <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #eee' }}><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Napiši što ti treba…" style={{ flex: 1, border: '1px solid #ccc', borderRadius: 12, padding: 12 }} /><button onClick={send} disabled={loading} style={{ border: 0, borderRadius: 12, padding: '0 16px', background: '#ffd400', color: '#111', fontWeight: 900 }}>Pošalji</button></div>
    </div>}
  </main>;
}
