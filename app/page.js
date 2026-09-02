'use client';

import { useState } from 'react';

export default function Home() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Bok! 👋 Ja sam EtoMe AI. Reci što ti treba i pomoći ću ti.' }]);
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
    } catch { setMessages([...next, { role: 'assistant', content: 'Ups — trenutno sam nedostupan. Pokušaj ponovno.' }]); }
    finally { setLoading(false); }
  }

  return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    <section style={{ maxWidth: 760, width: '100%', textAlign: 'center' }}>
      <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: -3 }}>EtoMe<span style={{ color: '#2e7d32' }}>24h</span></div>
      <p style={{ fontSize: 20, color: '#555' }}>Tu smo kad treba. 24 sata dnevno.</p>
      <button onClick={() => setOpen(true)} style={{ border: 0, borderRadius: 999, padding: '16px 28px', background: '#111', color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>💬 Pitaj EtoMe AI</button>
    </section>

    {open && <div style={{ position: 'fixed', right: 18, bottom: 18, width: 'min(390px, calc(100vw - 36px))', height: 560, background: '#fff', borderRadius: 20, boxShadow: '0 15px 50px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #ddd' }}>
      <header style={{ background: '#111', color: '#fff', padding: 16, display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}><span>🤖 EtoMe AI</span><button onClick={() => setOpen(false)} style={{ background: 'none', color: '#fff', border: 0, fontSize: 20 }}>×</button></header>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {messages.map((m, i) => <div key={i} style={{ margin: '8px 0', textAlign: m.role === 'user' ? 'right' : 'left' }}><span style={{ display: 'inline-block', maxWidth: '85%', padding: '10px 13px', borderRadius: 14, background: m.role === 'user' ? '#e7f5e8' : '#f1f1f1' }}>{m.content}</span></div>)}
        {loading && <div style={{ color: '#777' }}>EtoMe AI razmišlja…</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #eee' }}><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Napiši poruku…" style={{ flex: 1, border: '1px solid #ccc', borderRadius: 12, padding: 12 }} /><button onClick={send} disabled={loading} style={{ border: 0, borderRadius: 12, padding: '0 16px', background: '#2e7d32', color: '#fff', fontWeight: 700 }}>Pošalji</button></div>
    </div>}
  </main>;
}
