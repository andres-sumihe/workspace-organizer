import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { ApiConnectionGuard } from './components/api-connection-guard';
import { ErrorBoundary } from './components/error-boundary';
import { ThemeProvider } from './components/theme-provider';
import { ValidationSettingsProvider } from './contexts/validation-settings-context';
import { queryClient } from './lib/query-client';
import './styles/globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="workspace-organizer-theme">
          <ApiConnectionGuard>
            <ValidationSettingsProvider>
              <App />
            </ValidationSettingsProvider>
          </ApiConnectionGuard>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
