import { useEffect, useState } from 'react';

type BankLine = {
  id: string;
  amount: number;
  description: string;
  txDate: string;
};

export default function App() {
  const [health, setHealth] = useState('checking...');
  const [rows, setRows] = useState<BankLine[]>([]);

  useEffect(() => {
    fetch('http://localhost:3000/health')
      .then((response) => response.json())
      .then((data) => setHealth(data.ok ? 'ok' : 'not ok'))
      .catch(() => setHealth('error'));

    fetch('http://localhost:3000/bank-lines')
      .then((response) => response.json())
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>APGMS</h1>
      <p>API health: {health}</p>
      <h2>BankLines</h2>
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            {new Date(row.txDate).toLocaleDateString()} — {row.description} — ${row.amount}
          </li>
        ))}
      </ul>
    </main>
  );
}
