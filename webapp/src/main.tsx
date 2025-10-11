import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return <div className="p-6">APGMS Webapp</div>;
}

createRoot(document.getElementById('root')!).render(<App />);
