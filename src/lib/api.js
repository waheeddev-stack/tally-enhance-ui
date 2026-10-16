const BASE = (window.__API_URL || import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export function getToken() { return sessionStorage.getItem('tc_token') || localStorage.getItem('tc_token'); }
export function setToken(t, remember) {
  sessionStorage.setItem('tc_token', t);
  if (remember) localStorage.setItem('tc_token', t);
}
export function clearToken() { sessionStorage.removeItem('tc_token'); localStorage.removeItem('tc_token'); }

export async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}), ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function uploadBill(file, demo) {
  const fd = new FormData();
  if (file) fd.append('file', file);
  if (demo) fd.append('demo', demo);
  const res = await fetch(BASE + '/bills', { method: 'POST', headers: { ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) }, body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

export const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN');

export const aiLabel = s => ({ kaggle: '✦ Kaggle GPU', gemini: '✦ Gemini free', groq: 'Groq free', openrouter: 'OpenRouter free' }[s] || 'local demo model');
