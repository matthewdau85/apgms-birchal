import React from 'react';
import GatesRoute from './routes/gates';
import PoliciesRoute from './routes/policies';

const App: React.FC = () => {
  return (
    <main className="app-shell">
      <PoliciesRoute />
      <GatesRoute />
    </main>
  );
};

export default App;
