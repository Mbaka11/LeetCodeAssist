import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '../../dashboard/App';
import { startAppearance } from '../../lib/appearance';
import { rememberCurrentWindow } from '../../lib/sidePanel';
import '../../styles/theme.css';

startAppearance();
rememberCurrentWindow();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
