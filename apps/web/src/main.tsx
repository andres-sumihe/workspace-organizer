import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { ApiConnectionGuard } from './components/api-connection-guard';
import { ErrorBoundary } from './components/error-boundary';
import { ThemeProvider } from './components/theme-provider';
import { ValidationSettingsProvider } from './contexts/validation-settings-context';
import './styles/globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" storageKey="workspace-organizer-theme">
        <ApiConnectionGuard>
          <ValidationSettingsProvider>
            <App />
          </ValidationSettingsProvider>
        </ApiConnectionGuard>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
