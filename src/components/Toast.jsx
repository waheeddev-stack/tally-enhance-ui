import React, { useEffect, useState } from 'react';

export function toast(msg, kind = 'info') {
  window.dispatchEvent(new CustomEvent('tc-toast', { detail: { msg, kind, id: Math.random() } }));
}

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const h = e => {
      const t = e.detail;
      setItems(p => [...p, t]);
      setTimeout(() => setItems(p => p.filter(x => x !== t)), 3800);
    };
    window.addEventListener('tc-toast', h);
    return () => window.removeEventListener('tc-toast', h);
  }, []);
  const color = k => (k === 'error' ? 'var(--danger)' : k === 'ok' ? '#16a34a' : 'var(--accent)');
  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 99, display: 'grid', gap: 8, maxWidth: 360 }}>
      {items.map(t => (
        <div key={t.id} className="card toast-in" style={{ borderLeft: `4px solid ${color(t.kind)}`, padding: '12px 16px', boxShadow: '0 12px 32px rgba(109,40,217,0.2)', fontWeight: 500 }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
