import React from 'react';
import ReactDOM from 'react-dom/client';
import { startAppearance } from '../../lib/appearance';
import { SidePanelApp } from '../../sidepanel/SidePanelApp';
import '../../styles/theme.css';

startAppearance();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidePanelApp />
  </React.StrictMode>,
);
