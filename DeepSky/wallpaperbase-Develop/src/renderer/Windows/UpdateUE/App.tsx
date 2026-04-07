import { useEffect } from 'react';
import { injectGlobalStyles, useStyles } from './styles';
import Main from './pages/Main';

function App() {
  const { styles } = useStyles();

  useEffect(() => {
    const cleanup = injectGlobalStyles();
    return cleanup;
  }, []);

  return (
    <div className={styles.welcomeContainer}>
      <Main />
    </div>
  );
}

export default App;
