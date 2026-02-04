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
          background: '#313A48', // --color-surface-2
          color: '#E4E8EF',       // --color-text
          border: '1px solid rgba(255, 255, 255, 0.08)',
        },
        success: {
          duration: 3000,
          iconTheme: {
            primary: '#22C55E',   // --color-success
            secondary: '#1C2128', // --color-bg
          },
        },
        error: {
          duration: 4000,
          iconTheme: {
            primary: '#EF4444',   // --color-danger
            secondary: '#1C2128', // --color-bg
          },
        },
      }}
    />
  </StrictMode>
);
