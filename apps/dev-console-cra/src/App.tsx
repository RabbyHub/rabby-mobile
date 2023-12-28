import React from 'react';
import './App.less';
import { useVConsole } from './hooks/useDebug';

import DebugPostMessage from './pages/DebugPostMessage';

function App() {
  useVConsole({ isTop: true });

  return (
    <div className="App">
      <header className="App-header">Dev Console Page</header>
      <DebugPostMessage />
    </div>
  );
}

export default App;
