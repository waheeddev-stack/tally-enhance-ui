import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './tokens.css';

// Runtime API URL: public/config.json lets hosting (Cloudflare Pages etc.)
// point at any server with no rebuild. Falls back to build-time VITE_API_URL.
async function boot() {
  try {
    const r = await fetch('/config.json', { cache: 'no-store' });
    if (r.ok) {
      const cfg = await r.json().catch(() => ({}));
      if (cfg.apiUrl) window.__API_URL = cfg.apiUrl;
    }
  } catch { /* dev proxy / missing file — use VITE_API_URL */ }
  createRoot(document.getElementById('root')).render(
    <BrowserRouter><App /></BrowserRouter>
  );
}
boot();
