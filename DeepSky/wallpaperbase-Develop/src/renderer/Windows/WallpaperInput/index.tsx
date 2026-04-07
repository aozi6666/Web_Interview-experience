import { createRoot } from 'react-dom/client';
import { UserProvider } from '../../contexts/UserContext';
import { FullscreenProvider } from '../../contexts/FullscreenContext';
import { RTCContextProvider } from '../../contexts/RTCContext';
import { SystemStatusProvider } from '../../contexts/SystemStatusContext';
import App from './App';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(
  <FullscreenProvider>
    <UserProvider>
      <SystemStatusProvider>
        <RTCContextProvider mode="subscriber">
          <App />
        </RTCContextProvider>
      </SystemStatusProvider>
    </UserProvider>
  </FullscreenProvider>,
);
