import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Auto reload on Vite dynamic import chunk failure (e.g. after a new production deployment)
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const retryKey = 'vite_chunk_reload_ts';
  const lastReload = Number(sessionStorage.getItem(retryKey) || '0');
  const now = Date.now();
  if (now - lastReload > 10000) {
    sessionStorage.setItem(retryKey, String(now));
    window.location.reload();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
