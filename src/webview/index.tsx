import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './webview.css';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
