import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PreviewApp } from './preview/PreviewApp';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <PreviewApp />
  </StrictMode>,
);
