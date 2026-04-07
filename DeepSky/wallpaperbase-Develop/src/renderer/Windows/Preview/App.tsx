import { UESence_AppearShowBlank } from '@api/IPCRequest/selectUESence';
import { useEffect, useRef, useState } from 'react';
// import './index.css';
import { injectGlobalStyles, useStyles } from './styles';
import Main from './pages/Main';

function App() {
  
  const { styles } = useStyles();
  useEffect(() => {
    const cleanup = injectGlobalStyles();
    return cleanup;
  }, []);

  return (
    <div className={styles.previewContainer}>
      <Main/>
    </div>
  );
}

export default App;
