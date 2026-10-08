import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Boot Pendo exactly once per page load; the agent is loaded by the install
// snippet in index.html. An empty visitor id reuses a returning visitor's id
// from cookies/localStorage, or starts a new anonymous visitor. If sign-in is
// added later, register the user there with pendo.identify() — a second
// pendo.initialize() call is silently ignored by the SDK.
pendo.initialize({
  visitor: {
    id: '',
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
