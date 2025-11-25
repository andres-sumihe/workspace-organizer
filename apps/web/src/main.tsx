import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { ThemeProvider } from './components/theme-provider';
import { FileManagerProvider } from './contexts/file-manager-context';
import { ValidationSettingsProvider } from './contexts/validation-settings-context';
import './styles/globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="light" storageKey="workspace-organizer-theme">
      <ValidationSettingsProvider>
        <FileManagerProvider>
          <App />
        </FileManagerProvider>
      </ValidationSettingsProvider>
    </ThemeProvider>
  </React.StrictMode>
);
