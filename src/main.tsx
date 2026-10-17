import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { controller } from './app/controller';
import { App } from './ui/App';
import './ui/skin.css';

controller.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
