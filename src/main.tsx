import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { observeAppViewport } from './utils/appViewport';

const stopObservingViewport = observeAppViewport();
if (import.meta.hot) import.meta.hot.dispose(stopObservingViewport);

createRoot(document.getElementById('root')!).render(<App />);

if (import.meta.env.PROD && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('ServiceWorker registered:', registration.scope);
      })
      .catch((error) => {
        console.error('ServiceWorker registration failed:', error);
      });
  });
}
