import { useEffect, useState } from 'react';

type BankLine = { id: string; amount: number; description: string; txDate: string };

export default function App() {
  const [health, setHealth] = useState<string>('checking...');
  const [rows, setRows] = useState<BankLine[]>([]);

  useEffect(() => {
    fetch('http://localhost:3000/health')
      .then(r => r.json()).then(d => setHealth(d.ok ? 'ok' : 'not ok'))
      .catch(() => setHealth('error'));

    fetch('http://localhost:3000/bank-lines')
      .then(r => r.json()).then(setRows)
      .catch(() => setRows([]));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>APGMS Webapp</h1>
      <p>API health: {health}</p>
      <h2>BankLines</h2>
      <ul>
        {rows.map(r => (
          <li key={r.id}>
            {new Date(r.txDate).toLocaleDateString()} — {r.description} — ${r.amount}
          </li>
        ))}
      </ul>
    </main>
  );
}
