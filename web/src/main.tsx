import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

function MissingKeyScreen() {
  return (
    <div className="page">
      <div className="card">
        <div className="brand">
          <h1>Clerk not configured</h1>
          <p className="error">
            Add your Clerk publishable key to <code>web/.env</code> as{' '}
            <code>VITE_CLERK_PUBLISHABLE_KEY</code>, then restart this app.
          </p>
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById('root')!;

if (!publishableKey || publishableKey.includes('pk_test_...')) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <MissingKeyScreen />
    </React.StrictMode>
  );
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ClerkProvider publishableKey={publishableKey}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ClerkProvider>
    </React.StrictMode>
  );
}
