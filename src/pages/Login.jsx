import React, { useState } from 'react';
import { api, setToken } from '../lib/api.js';

export default function Login({ onDone }) {
  const [email, setEmail] = useState('admin@sharma.local');
  const [password, setPassword] = useState('admin123');
  const [err, setErr] = useState('');
  const go = async e => {
    e.preventDefault(); setErr('');
    try {
      const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setToken(r.token);
      if (r.user.must_change_password) { /* keep simple: still enter */ }
      onDone(r.user); location.href = '/';
    } catch (e) { setErr(e.message); }
  };
  return (
    <div className="main" style={{ maxWidth: 460, paddingTop: 64 }}>
      <div className="floaty" style={{ fontSize: 54 }}>✦</div>
      <div className="login-hero" style={{ fontSize: 58, marginBottom: 6 }}>Tally<br /><span className="grad-text">Copilot</span></div>
      <p className="muted" style={{ fontSize: 15 }}>Your books, but make it <b>main-character energy</b>. Snap a bill, get answers, skip the CA call.</p>
      <div className="sticker-row" style={{ margin: '12px 0 2px' }}>
        <span className="sticker pop">no CA needed ★</span>
        <span className="sticker">Hinglish OK ✦</span>
        <span className="sticker lime">GST-proof-ish ☾</span>
      </div>
      <form onSubmit={go} className="card pop-in" style={{ display: 'grid', gap: 12, marginTop: 18 }}>
        <input className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
        <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
        {err && <div className="pop-in" style={{ color: 'var(--danger)', fontWeight: 600 }}>{err}</div>}
        <button className="btn" type="submit">Let's go →</button>
        <div className="hand" style={{ fontSize: 21, textAlign: 'center', color: 'var(--accent)', transform: 'rotate(-1.5deg)' }}>psst… logins are pre-filled, just smash the button ↓</div>
      </form>
    </div>
  );
}
