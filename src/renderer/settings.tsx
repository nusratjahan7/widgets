import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsApp } from './settings/SettingsApp';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <SettingsApp />
  </StrictMode>,
);
