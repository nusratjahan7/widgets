import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CityEditor } from './CityEditor';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <CityEditor />
  </StrictMode>,
);
