import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ReminderEditor } from './ReminderEditor';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <ReminderEditor />
  </StrictMode>,
);
