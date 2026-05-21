import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import './style.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

function App() {
  const [health, setHealth] = useState('checking...');

  useEffect(() => {
    axios.get('/health')
      .then(() => setHealth('Backend connected'))
      .catch(() => setHealth('Backend not reachable'));
  }, []);

  return (
    <main className="page">
      <section className="card">
        <h1>Fullstack App</h1>
        <p>Frontend: React/Vite</p>
        <p>Backend: Node.js + Express</p>
        <p>Database: MySQL</p>
        <p>API Base URL: {API_BASE_URL}</p>
        <strong>{health}</strong>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
