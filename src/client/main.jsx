import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import './standalone.scss';
import { BrowserRouter } from 'react-router-dom';

// Global error handler for a known, non-fatal CodeMirror DOM error.
window.addEventListener('error', (event) => {
  if (
    event.error instanceof RangeError &&
    event.error.message.includes(
      'Trying to find position for a DOM position outside of the document',
    )
  ) {
    console.log('Suppressed CodeMirror DOM position error:', event.error);
    return true;
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));

async function start() {
  // The capability token is in the URL fragment, never sent in HTTP
  // requests or referrers. Exchange it for an HttpOnly session cookie.
  const fragment = new URLSearchParams(
    window.location.hash.slice(1),
  );
  const token = fragment.get('vzcode-token');
  if (token) {
    const response = await fetch('/auth/session', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      credentials: 'same-origin',
    });
    if (!response.ok) {
      throw new Error('Invalid VZCode access link.');
    }
    // Remove the sensitive fragment from browser history.
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    );
  }

  const status = await fetch('/auth/status', {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!status.ok) {
    throw new Error(
      'Authorization required. Open the private URL printed by the VZCode CLI.',
    );
  }
  // App creates its WebSocket at module initialization; it must load
  // only after the session cookie has been established.
  const { default: App } = await import('./App');
  root.render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  );
}

start().catch((error) => {
  console.error('VZCode authentication failed:', error);
  const message = document.createElement('p');
  message.style.padding = '2rem';
  message.textContent = error.message;
  document.getElementById('root').replaceChildren(message);
});
