import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { downloadCSV } from '../lib/csv.js';
import { toast } from '../components/Toast.jsx';
import { MODULES } from '../lib/roles.js';

const emptyEdit = { role_preset: 'data_entry', amount_limit: 0, approval_limit: 0, needs_approval: false, active: true, expires_on: '', modules: null, hidden_groups: [], ai_ask: false, chat_cap: '', bill_cap: '', date_lock: '' };

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', role_preset: 'data_entry', temp_password: 'temp1234' });
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(null);
  const [edit, setEdit] = useState(emptyEdit);

  const load = () => {
    api('/admin/users').then(r => setUsers(r.users)).catch(e => setMsg(e.message));
    api('/admin/audit').then(r => setAudit(r.rows)).catch(() => {});
    api('/groups').then(r => setGroups(r.groups)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const create = async e => {
    e.preventDefault(); setMsg('');
    try { await api('/admin/users', { method: 'POST', body: JSON.stringify(form) }); toast('User created — share the temp password', 'ok'); setForm({ ...form, name: '', email: '' }); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const startEdit = u => {
    const p = u.permissions || {};
    setEditing(u.id);
    setEdit({
      role_preset: u.role_preset, amount_limit: u.amount_limit || 0, approval_limit: u.approval_limit || 0,
      needs_approval: !!u.needs_approval, active: u.active !== false, expires_on: u.expires_on || '',
      modules: Array.isArray(p.modules) ? p.modules : null,
      hidden_groups: p.hidden_groups || [], ai_ask: p['ai.ask'] === true,
      chat_cap: p.daily_chat_cap || '', bill_cap: p.daily_bill_cap || '', date_lock: p.date_lock || '',
    });
  };

  const saveEdit = async id => {
    const permissions = {
      ...(editing ? {} : {}),
      modules: edit.modules, hidden_groups: edit.hidden_groups,
      'ai.ask': edit.ai_ask || undefined,
      daily_chat_cap: edit.chat_cap ? Number(edit.chat_cap) : undefined,
      daily_bill_cap: edit.bill_cap ? Number(edit.bill_cap) : undefined,
      date_lock: edit.date_lock || undefined,
    };
    Object.keys(permissions).forEach(k => permissions[k] === undefined && delete permissions[k]);
    try {
      await api(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          role_preset: edit.role_preset, amount_limit: Number(edit.amount_limit) || 0,
          approval_limit: Number(edit.approval_limit) || 0, needs_approval: edit.needs_approval,
          active: edit.active, expires_on: edit.expires_on || null, permissions,
        }),
      });
      toast('Restrictions saved — apply on the user’s next request', 'ok');
      setEditing(null); load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const toggleMod = m => setEdit(e => {
    const cur = e.modules || [...MODULES];
    return { ...e, modules: cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m] };
  });
  const toggleGroup = g => setEdit(e => ({
    ...e, hidden_groups: e.hidden_groups.includes(g) ? e.hidden_groups.filter(x => x !== g) : [...e.hidden_groups, g],
  }));

  const viewAs = async id => {
    try {
      const r = await api(`/admin/users/${id}/view-as`, { method: 'POST' });
      sessionStorage.setItem('tc_token', r.token); sessionStorage.setItem('tc_viewas', '1'); location.href = '/';
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <div className="serif" style={{ fontSize: 36 }}>Admin</div>
      <p className="muted">Exactly one admin · creates every user · per-user modules, limits, hidden ledgers, AI caps · all audited.</p>
      {msg && <p className="muted">{msg}</p>}

      <div className="card"><h3 style={{ marginTop: 0 }}>New user</h3>
        <form onSubmit={create} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 160 }} placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input" style={{ maxWidth: 210 }} placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <select className="select" style={{ maxWidth: 140 }} value={form.role_preset} onChange={e => setForm({ ...form, role_preset: e.target.value })}>
            <option value="accountant">Accountant</option><option value="data_entry">Data entry</option><option value="viewer">Viewer</option>
          </select>
          <input className="input" style={{ maxWidth: 140 }} placeholder="Temp password" value={form.temp_password} onChange={e => setForm({ ...form, temp_password: e.target.value })} />
          <button className="btn">Create</button>
        </form>
        <p className="muted" style={{ fontSize: 12 }}>New users start Active and must change the temp password at first login. Fine-tune limits below via Restrictions.</p>
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        {users.map(u => (
          <div key={u.id} className="card">
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <b>{u.name}</b><span className="mono muted" style={{ fontSize: 12 }}>{u.email}</span>
              <span className="pill">{u.is_admin ? 'admin' : u.role_preset}</span>
              {!u.active && <span className="pill draft">inactive</span>}
              {u.needs_approval && <span className="pill pending">needs approval</span>}
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {!u.is_admin && <>
                  <button className="btn-ghost" style={{ padding: '4px 10px' }} onClick={() => (editing === u.id ? setEditing(null) : startEdit(u))}>Restrictions</button>
                  <button className="btn-ghost" style={{ padding: '4px 10px' }} onClick={() => viewAs(u.id)}>View as</button>
                  <button className="btn-ghost" style={{ padding: '4px 10px' }} onClick={async () => { const r = await api(`/admin/users/${u.id}/reset-password`, { method: 'POST', body: JSON.stringify({}) }); toast(`Temp password: ${r.temp_password}`, 'info'); }}>Reset pw</button>
                  <button className="btn-ghost" style={{ padding: '4px 10px' }} onClick={async () => { await api(`/admin/users/${u.id}/force-logout`, { method: 'POST' }); toast('Session revoked', 'ok'); }}>Logout</button>
                </>}
              </span>
            </div>
            {(u.amount_limit > 0 || u.approval_limit > 0) && <div className="muted mono" style={{ fontSize: 12, marginTop: 4 }}>create ≤ ₹{Number(u.amount_limit || 0).toLocaleString('en-IN')} · approve ≤ ₹{Number(u.approval_limit || 0).toLocaleString('en-IN')}</div>}

            {editing === u.id && (
              <div style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 10, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label>Role <select className="select" value={edit.role_preset} onChange={e => setEdit({ ...edit, role_preset: e.target.value })}>
                    <option value="accountant">Accountant</option><option value="data_entry">Data entry</option><option value="viewer">Viewer</option>
                  </select></label>
                  <label>Create limit ₹<input className="input mono" type="number" value={edit.amount_limit} onChange={e => setEdit({ ...edit, amount_limit: e.target.value })} style={{ maxWidth: 130 }} /></label>
                  <label>Approve limit ₹<input className="input mono" type="number" value={edit.approval_limit} onChange={e => setEdit({ ...edit, approval_limit: e.target.value })} style={{ maxWidth: 130 }} /></label>
                  <label>Expiry<input className="input" type="date" value={edit.expires_on} onChange={e => setEdit({ ...edit, expires_on: e.target.value })} /></label>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={edit.needs_approval} onChange={e => setEdit({ ...edit, needs_approval: e.target.checked })} /> Needs approval</label>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={edit.active} onChange={e => setEdit({ ...edit, active: e.target.checked })} /> Active</label>
                </div>
                <div><b style={{ fontSize: 13 }}>Modules visible</b> <span className="muted" style={{ fontSize: 12 }}>(untick to hide; applies on next request)</span>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                    {MODULES.map(m => <label key={m} style={{ fontSize: 13, display: 'flex', gap: 5 }}><input type="checkbox" checked={(edit.modules || MODULES).includes(m)} onChange={() => toggleMod(m)} />{m}</label>)}
                  </div></div>
                <div><b style={{ fontSize: 13 }}>Hidden ledger groups</b>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                    {groups.map(g => <label key={g.id} style={{ fontSize: 13, display: 'flex', gap: 5 }}><input type="checkbox" checked={edit.hidden_groups.includes(g.name)} onChange={() => toggleGroup(g.name)} />{g.name}</label>)}
                  </div></div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ fontSize: 13, display: 'flex', gap: 5 }}><input type="checkbox" checked={edit.ai_ask} onChange={e => setEdit({ ...edit, ai_ask: e.target.checked })} /> Ask AI allowed</label>
                  <label style={{ fontSize: 13 }}>Chat/day <input className="input mono" type="number" value={edit.chat_cap} onChange={e => setEdit({ ...edit, chat_cap: e.target.value })} style={{ maxWidth: 80 }} placeholder="30" /></label>
                  <label style={{ fontSize: 13 }}>Bills/day <input className="input mono" type="number" value={edit.bill_cap} onChange={e => setEdit({ ...edit, bill_cap: e.target.value })} style={{ maxWidth: 80 }} placeholder="20" /></label>
                  <label style={{ fontSize: 13 }}>Date lock from <input className="input" type="date" value={edit.date_lock} onChange={e => setEdit({ ...edit, date_lock: e.target.value })} /></label>
                  <button className="btn" onClick={() => saveEdit(u.id)}>Save restrictions</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 12 }}><h3>Audit log (latest {audit.length}) <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12, marginLeft: 8 }} onClick={() => { downloadCSV('audit.csv', audit); toast('Audit trail exported', 'ok'); }}>↓ Export CSV</button></h3>
        <table className="table"><tbody>{audit.slice(0, 30).map((a, i) => <tr key={i}><td className="mono">{(a.created_at || '').slice(0, 16)}</td><td>{a.actor}</td><td>{a.action}</td><td className="mono">{a.entity}/{String(a.entity_id || '').slice(0, 8)}</td></tr>)}</tbody></table></div>
    </div>
  );
}
