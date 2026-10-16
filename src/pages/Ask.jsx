import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api, inr, aiLabel } from '../lib/api.js';

const CHIPS = [
  'Which customers owe me more than 50k for over 60 days?',
  'Top suppliers I need to pay',
  'GST summary by month',
  'Show recent purchases',
  'Which stock items are below reorder level?',
  'Mujhe 60 din se zyada se paise dene wale grahak kaun hain?',
];

export default function Ask() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [q, setQ] = useState(sp.get('q') || '');
  const [ans, setAns] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const ask = async text => {
    const qq = text ?? q;
    if (!qq.trim()) return;
    setLoading(true); setErr(''); setAns(null);
    try { setAns(await api('/chat', { method: 'POST', body: JSON.stringify({ question: qq }) })); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };
  const chartData = ans?.rows?.slice(0, 12).map(r => {
    const keys = Object.keys(r);
    return { name: String(r[keys[0]]).slice(0, 14), value: Number(r[keys[1]]) || 0 };
  }) || [];
  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div className="serif" style={{ fontSize: 36, textAlign: 'center' }}>Ask your books <span className="sticker lime" style={{ fontSize: 12, verticalAlign: 'middle' }}>no dumb questions ☾</span></div>
      <p className="muted" style={{ textAlign: 'center' }}>English, Hinglish · generated SQL is always shown</p>
      <div className="topbar"><input className="input" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} placeholder="e.g. Which customers owe me more than 50k for over 60 days?" />
        <button className="btn" disabled={loading} onClick={() => ask()}>{loading ? '…' : 'Ask'}</button></div>
      {!ans && !loading && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{CHIPS.map(c => <button key={c} className="chip" onClick={() => { setQ(c); ask(c); }}>{c}</button>)}</div>}
      {loading && <div className="card"><div style={{ fontWeight: 700, fontFamily: 'var(--font-display)' }}>Cooking your answer<span className="typing"><i /><i /><i /></span></div><div className="skel" style={{ marginTop: 10 }} /><div className="skel" style={{ marginTop: 8, width: '70%' }} /></div>}
      {err && <div style={{ color: 'var(--danger)' }}>{err}</div>}
      {ans && (
        <div className="card pop-in">
          <b>{ans.title}</b> <span className="pill" style={{ marginLeft: 6 }}>{aiLabel(ans.ai_source)}</span>
          <p>{ans.summary}</p>
          {ans.ai_note && <p className="muted" style={{ fontSize: 12 }}>ℹ {ans.ai_note}</p>}
          {ans.chart === 'bar' && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={240}><BarChart data={chartData}><defs><linearGradient id="askGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" /><stop offset="100%" stopColor="#2563EB" /></linearGradient></defs><XAxis dataKey="name" tickLine={false} axisLine={{ stroke: '#E6DEF9' }} /><YAxis tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="value" fill="url(#askGrad)" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>
          )}
          {ans.rows?.length > 0 && (
            <table className="table" style={{ marginTop: 12 }}><thead><tr>{ans.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{ans.rows.slice(0, 20).map((r, i) => <tr key={i}>{ans.columns.map(c => <td key={c} className="mono">{typeof r[c] === 'number' ? (c.match(/amount|total|balance|outstanding|tax|cgst|sgst|igst/i) ? inr(r[c]) : r[c].toLocaleString('en-IN')) : String(r[c] ?? '')}</td>)}</tr>)}</tbody></table>
          )}
          {(!ans.rows || ans.rows.length === 0) && !ans.restricted && (
            <div style={{ textAlign: 'center', padding: '28px 16px', border: '1px dashed var(--line)', borderRadius: 12, marginTop: 12, background: '#FDFDFB' }}>
              <div style={{ fontSize: 40 }}>◌</div>
              <div className="serif" style={{ fontSize: 26, marginTop: 4 }}>No info in the books — yet</div>
              <div className="hand" style={{ fontSize: 22, color: 'var(--accent2)' }}>fr tho, the query slapped — the books are just empty ✦</div>
              <p className="muted" style={{ maxWidth: 460, margin: '6px auto' }}>
                "{ans.title}" returned zero rows. The query itself is fine — there is simply no matching data posted yet.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <button className="btn" onClick={() => nav('/upload')}>Upload your first bill</button>
                <button className="btn-ghost" onClick={() => nav('/vouchers/new')}>New voucher <kbd>F9</kbd></button>
              </div>
            </div>
          )}
          <details style={{ marginTop: 12 }}><summary className="muted">How I got this (SQL)</summary><pre className="sqlbox mono" style={{ fontSize: 12 }}>{ans.sql}</pre></details>
        </div>
      )}
    </div>
  );
}
