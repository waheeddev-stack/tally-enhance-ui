import React, { useEffect, useState } from 'react';
import { NavLink, Routes, Route, useNavigate } from 'react-router-dom';
import { api, getToken, clearToken } from './lib/api.js';
import { Toaster } from './components/Toast.jsx';
import { ConfettiHost } from './components/Confetti.jsx';
import { isAdmin, canApprove, canUpload, canAsk, canVouchers, canAlerts, canReports, inModule, roleLabel } from './lib/roles.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Upload from './pages/Upload.jsx';
import Vouchers from './pages/Vouchers.jsx';
import VoucherNew from './pages/VoucherNew.jsx';
import VoucherDetail from './pages/VoucherDetail.jsx';
import Ask from './pages/Ask.jsx';
import Alerts from './pages/Alerts.jsx';
import Reports from './pages/Reports.jsx';
import Admin from './pages/Admin.jsx';
import Approvals from './pages/Approvals.jsx';

function Denied({ what }) {
  return <div className="card"><b>Not available for your role.</b><p className="muted">{what || 'Ask your admin for access.'}</p></div>;
}

function Shell({ me, setMe }) {
  const nav = useNavigate();
  const [viewAs] = useState(sessionStorage.getItem('tc_viewas') === '1');
  const logout = () => { clearToken(); sessionStorage.removeItem('tc_viewas'); setMe(null); nav('/login'); };

  const NAV = [
    { to: '/', label: 'Dashboard', icon: '◈', show: true },
    { to: '/upload', label: 'Upload Bill', icon: '⇪', show: canUpload(me) && inModule(me, 'Upload Bill', 'Upload') },
    { to: '/vouchers', label: 'Vouchers', icon: '▤', show: canVouchers(me) && inModule(me, 'Vouchers') },
    { to: '/approvals', label: 'Approvals', icon: '✓', show: canApprove(me) || me.role_preset === 'data_entry' },
    { to: '/ask', label: 'Ask AI', icon: '✦', show: canAsk(me) && inModule(me, 'Ask AI', 'Ask') },
    { to: '/alerts', label: 'Alerts', icon: '⚑', show: canAlerts(me) && inModule(me, 'Alerts') },
    { to: '/reports', label: 'Reports', icon: '◫', show: canReports(me) && inModule(me, 'Reports') },
    { to: '/admin', label: 'Admin', icon: '⚙', show: isAdmin(me) },
  ].filter(n => n.show);

  // Global shortcuts: Ctrl+K -> Ask, F9 -> new purchase voucher
  useEffect(() => {
    const h = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (canAsk(me)) nav('/ask'); }
      if (e.key === 'F9') { e.preventDefault(); if (canVouchers(me)) nav('/vouchers/new?type=purchase'); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [me]);

  return (
    <div>
      <Toaster />
      <ConfettiHost />
      <div className="bg-blobs" aria-hidden="true"><i /><i /><i /></div>
      {viewAs && <div className="viewbanner">VIEW-AS MODE (read-only) — acting as {me?.name} <button className="btn-ghost" style={{ color: '#fff', borderColor: '#444', marginLeft: 12, padding: '4px 10px' }} onClick={() => { sessionStorage.removeItem('tc_viewas'); location.href = '/'; }}>Exit</button></div>}
      <div className="layout">
        <aside className="sidebar">
          <div className="brand">Tally Copilot</div>
          <div className="muted" style={{ fontSize: 12, padding: '0 10px 12px' }}>Sharma Traders · FY 25-26</div>
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => 'navlink' + (isActive ? ' active' : '')}>
              <span style={{ width: 20 }}>{n.icon}</span>{n.label}
            </NavLink>
          ))}
          <div style={{ marginTop: 'auto', padding: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{me?.name}</div>
            <div className="muted" style={{ fontSize: 12 }}>{roleLabel(me)} · {me?.email}</div>
            {(me.amount_limit > 0 || me.approval_limit > 0) && (
              <div className="muted mono" style={{ fontSize: 11, marginTop: 4 }}>
                {me.amount_limit > 0 && <div>create ≤ ₹{Number(me.amount_limit).toLocaleString('en-IN')}</div>}
                {me.approval_limit > 0 && <div>approve ≤ ₹{Number(me.approval_limit).toLocaleString('en-IN')}</div>}
                {me.needs_approval && <div>needs approval</div>}
              </div>
            )}
            <button className="btn-ghost" style={{ marginTop: 8, width: '100%' }} onClick={logout}>Sign out</button>
            <div style={{ padding: '10px 10px 0' }}><span className="sticker pop" style={{ fontSize: 11 }}>v0.3 ✦ slime era</span></div>
          </div>
        </aside>
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={canUpload(me) ? <Upload /> : <Denied />} />
            <Route path="/vouchers" element={canVouchers(me) ? <Vouchers /> : <Denied what="Your role is reports-only." />} />
            <Route path="/vouchers/new" element={canVouchers(me) ? <VoucherNew me={me} /> : <Denied />} />
            <Route path="/vouchers/:id" element={<VoucherDetail me={me} viewAs={viewAs} />} />
            <Route path="/approvals" element={(canApprove(me) || me.role_preset === 'data_entry') ? <Approvals me={me} /> : <Denied />} />
            <Route path="/ask" element={canAsk(me) ? <Ask /> : <Denied what="AI is not enabled for your role." />} />
            <Route path="/alerts" element={canAlerts(me) ? <Alerts /> : <Denied />} />
            <Route path="/reports" element={canReports(me) ? <Reports /> : <Denied />} />
            <Route path="/admin" element={isAdmin(me) ? <Admin /> : <Denied />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api('/me').then(r => setMe(r.user)).catch(() => {}).finally(() => setReady(true));
  }, []);
  if (!ready) return <div className="main">Loading…</div>;
  if (!me) return <Login onDone={u => { setMe(u); location.href = '/'; }} />;
  return <Shell me={me} setMe={setMe} />;
}
