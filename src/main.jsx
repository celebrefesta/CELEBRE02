import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// 🔄 Auto-recuperação quando uma nova versão do app for publicada
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

window.addEventListener('error', (event) => {
  const msg = event?.message || '';
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Expected a JavaScript-or-Wasm module script')
  ) {
    const jaRecarregou = sessionStorage.getItem('celebre_chunk_reload');
    if (!jaRecarregou) {
      sessionStorage.setItem('celebre_chunk_reload', 'true');
      window.location.reload();
    }
  }
});

window.addEventListener('load', () => {
  setTimeout(() => {
    sessionStorage.removeItem('celebre_chunk_reload');
  }, 2000);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);