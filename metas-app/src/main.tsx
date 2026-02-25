import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: 'var(--color-surface-2)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
        },
        success: {
          duration: 3000,
          iconTheme: {
            primary: 'var(--color-success)',
            secondary: 'var(--color-bg)',
          },
        },
        error: {
          duration: 4000,
          iconTheme: {
            primary: 'var(--color-danger)',
            secondary: 'var(--color-bg)'
          },
        },
      }}
    />
  </StrictMode>
);
