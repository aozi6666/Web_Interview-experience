import { createRoot } from 'react-dom/client';
import { UserProvider } from '../../contexts/UserContext';
import App from './App';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(
  <UserProvider>
    <App />
  </UserProvider>,
);
