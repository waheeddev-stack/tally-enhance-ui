import React, { useEffect, useState } from 'react';

const COLORS = ['#7C3AED', '#2563EB', '#BEF264', '#65A30D', '#F59E0B', '#ffffff'];

export function burstConfetti() {
  window.dispatchEvent(new CustomEvent('tc-confetti', { detail: { id: Math.random() } }));
}

export function ConfettiHost() {
  const [bursts, setBursts] = useState([]);
  useEffect(() => {
    const h = e => {
      const b = {
        id: e.detail.id,
        pieces: Array.from({ length: 90 }, (_, i) => ({
          left: Math.random() * 100, delay: Math.random() * 0.35,
          color: COLORS[i % COLORS.length], round: Math.random() > 0.65, w: 7 + Math.random() * 8,
        })),
      };
      setBursts(p => [...p, b]);
      setTimeout(() => setBursts(p => p.filter(x => x !== b)), 2300);
    };
    window.addEventListener('tc-confetti', h);
    return () => window.removeEventListener('tc-confetti', h);
  }, []);
  return (
    <div className="confetti-layer" aria-hidden="true">
      {bursts.map(b => (
        <div key={b.id}>
          {b.pieces.map((pc, i) => (
            <i key={i} className="confetti-piece" style={{ left: pc.left + '%', background: pc.color, animationDelay: pc.delay + 's', width: pc.w, height: pc.w * 1.4, borderRadius: pc.round ? '50%' : 3 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
