import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/theme.css';
import { App } from './ui/App';
import { pickStartSave } from './save/hub';

// Load the newest save (this device or the cloud copy from the hub) before the game starts.
pickStartSave().then(start => {
  createRoot(document.getElementById('root')!).render(<StrictMode><App start={start} /></StrictMode>);
});
