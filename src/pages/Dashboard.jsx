import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api, inr } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import CountUp from '../components/CountUp.jsx';

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [q, setQ] = useState('');
  const [digest, setDigest] = useState(null);
  const nav = useNavigate();
  useEffect(() => { api('/dashboard').then(setD).catch(() => {}); }, []);
  if (!d) return <div><div className="skel" /> <div className="skel" style={{ marginTop: 8 }} /></div>;
  const age = Object.entries(d.ageing || {}).map(([bucket, amount]) => ({ bucket, amount }));
  const c = d.counts || {};
  const actions = [
    c.pending > 0 && { t: `${c.pending} voucher(s) waiting for approval`, s: 'clear the queue →', to: '/approvals', hot: true },
    c.high_flags > 0 && { t: `${c.high_flags} HIGH-severity flag(s)`, s: 'eyeball them →', to: '/alerts', hot: true },
    c.drafts > 0 && { t: `${c.drafts} draft(s) lying around`, s: 'finish them →', to: '/vouchers?status=draft' },
  ].filter(Boolean);
  const steps = [
    { t: 'Add your first ledger', done: c.ledgers > 0, to: '/vouchers/new' },
    { t: 'Post your first voucher', done: c.vouchers > 0, to: '/vouchers/new' },
    { t: 'Ask AI something juicy', done: false, to: '/ask' },
  ];
  const showChecklist = !steps.every(s => s.done);
  const openDigest = async () => {
    try {
      const dg = await api('/digest');
      setDigest({ ...dg, aiHead: null });
      api('/api/ai/digest-line', { method: 'POST', body: JSON.stringify({ bullets: dg.bullets }) })
        .then(r => setDigest(d => (d ? { ...d, aiHead: r } : d)))
        .catch(() => {});
    } catch (e) { toast(e.message, 'error'); }
  };
  const copyDigest = () => {
    navigator.clipboard.writeText(`◈ ${digest.company} — books summary\n` + digest.bullets.map(b => '• ' + b).join('\n')).then(
      () => toast('Digest copied — paste it anywhere', 'ok'),
      () => toast('Copy blocked by browser', 'error'));
  };
  return (
    <div>
      <div className="topbar">
        <div className="askbox"><input className="input" placeholder="Ask anything… (Ctrl+K) — English, Hinglish" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') nav('/ask?q=' + encodeURIComponent(q)); }} /></div>
        <button className="btn" onClick={openDigest}>✨ Explain my books</button>
      </div>
      <div className="serif" style={{ fontSize: 46, marginBottom: 2 }}>Namaste, <span className="stroke-text">bestie</span> <span className="grad-text">✦</span> <span className="sticker lime" style={{ fontSize: 13, verticalAlign: 'middle' }}>● LIVE</span></div>
      <p className="muted" style={{ marginTop: 0 }}>Your money, decoded — receivables, payables, GST and red flags at a glance.</p>
      <div className="marquee" aria-hidden="true"><div className="marquee-track">{[0, 1].map(copy => (
        <span key={copy}>
          <span>◈ <b>{inr(d.receivables)}</b> stuck with customers ✦ </span>
          <span>▤ <b>{inr(d.payables)}</b> you owe people ✦ </span>
          <span>⚑ <b>{d.open_alerts}</b> flags need eyeballs ✦ </span>
          <span>⬣ <b>{inr(d.gst_payable)}</b> GST burn ✦ </span>
          <span>no cap, just books ✦ </span>
        </span>))}</div></div>
      {actions.length > 0 && (
        <div className="grid4 stagger" style={{ marginTop: 14, gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {actions.map((a, i) => (
            <div key={i} className="card pop-in" style={{ cursor: 'pointer', borderLeft: a.hot ? '4px solid var(--danger)' : undefined }} onClick={() => nav(a.to)}>
              <b>{a.t}</b><div className="grad-text" style={{ fontWeight: 700 }}>{a.s}</div>
            </div>
          ))}
        </div>
      )}
      {d.recent?.length === 0 && (
        <div className="card" style={{ marginTop: 12, borderLeft: '3px solid var(--accent)' }}>
          <b>Fresh books — nothing posted yet.</b>
          <p className="muted">Upload your first bill, or press <kbd>F9</kbd> for a manual purchase voucher. Create ledgers inline with <kbd>Alt+C</kbd> as you type.</p>
        </div>
      )}
      {showChecklist && (
        <div className="card" style={{ marginTop: 14 }}>
          <b>Getting-started checklist</b> <span className="hand" style={{ fontSize: 19, color: 'var(--accent)' }}>— baby steps, big books ✦</span>
          <div className="progress" style={{ margin: '10px 0' }}><div style={{ width: `${Math.round((steps.filter(s => s.done).length / steps.length) * 100)}%` }} /></div>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', cursor: s.done ? 'default' : 'pointer', opacity: s.done ? 0.6 : 1 }} onClick={() => !s.done && nav(s.to)}>
              <span style={{ fontWeight: 800, color: s.done ? '#65A30D' : 'var(--muted)' }}>{s.done ? '✓' : '○'}</span><span style={{ textDecoration: s.done ? 'line-through' : 'none' }}>{s.t}</span>
            </div>
          ))}
        </div>
      )}
      <div className="grid4 stagger" style={{ marginTop: 16 }}>
        {[['Receivables', d.receivables], ['Payables', d.payables], ['GST payable', d.gst_payable], ['Open alerts', d.open_alerts, true]].map(([l, v, plain]) => (
          <div className="card stat-card pop-in" key={l}><div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{l}</div>
            <div className="statnum"><CountUp value={v} format={n => (plain ? Math.round(n) : inr(n))} /></div></div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
        <div className="card"><h3 style={{ marginTop: 0 }}>Receivables ageing</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={age}><defs><linearGradient id="ageGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" /><stop offset="100%" stopColor="#2563EB" /></linearGradient></defs><XAxis dataKey="bucket" tickLine={false} axisLine={{ stroke: '#E6DEF9' }} /><YAxis tickLine={false} axisLine={false} /><Tooltip formatter={v => inr(v)} /><Bar dataKey="amount" fill="url(#ageGrad)" radius={[8, 8, 0, 0]} /></BarChart>
          </ResponsiveContainer></div>
        <div className="card"><h3 style={{ marginTop: 0 }}>Recent vouchers</h3>
          <table className="table"><tbody>{d.recent.map((r, i) => (
            <tr key={i} onClick={() => nav('/vouchers')}><td className="mono">{r.number}</td><td>{r.party}</td><td className="mono">{inr(r.total)}</td><td><span className={`pill ${r.status}`}>{r.status}</span></td></tr>))}</tbody></table></div>
      </div>
      {digest && (
        <div className="modal-overlay" onClick={() => setDigest(null)}>
          <div className="modal-card card" onClick={e => e.stopPropagation()}>
            <div className="serif" style={{ fontSize: 28 }}>◈ {digest.company} <span className="sticker pop" style={{ fontSize: 11 }}>weekly-ish digest</span></div>
            {digest.aiHead ? (
              <div className="pop-in" style={{ marginTop: 8 }}>
                <div className="hand" style={{ fontSize: 26, color: 'var(--accent)' }}>{digest.aiHead.headline}</div>
                {digest.aiHead.next?.map((n, i) => <div key={i} style={{ fontSize: 13.5 }}>→ {n}</div>)}
              </div>
            ) : (
              <div className="skel" style={{ marginTop: 10, width: '70%' }} />
            )}
            <p className="muted">Plain-English books summary. Copy it to the group chat, your CA, your diary — we don't judge.</p>
            {digest.bullets.map((b, i) => <p key={i} style={{ borderLeft: '3px solid var(--lime)', paddingLeft: 10 }}>{b}</p>)}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn" onClick={copyDigest}>Copy summary</button>
              <button className="btn-ghost" onClick={() => setDigest(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
