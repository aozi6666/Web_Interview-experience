import { createContext, useContext, type ReactNode } from 'react';
import UpdateModal from '../components/UpdateModal';
import { useVersionCheck } from '../pages/User/hooks/useVersionCheck';

type VersionCheckState = ReturnType<typeof useVersionCheck>;

const VersionCheckContext = createContext<VersionCheckState | null>(null);

export function VersionCheckProvider({ children }: { children: ReactNode }) {
  const versionCheck = useVersionCheck();

  return (
    <VersionCheckContext.Provider value={versionCheck}>
      {children}
      <UpdateModal
        open={versionCheck.showUpdateModal}
        currentVersion={versionCheck.currentVersion}
        latestVersion={versionCheck.latestVersion}
        releaseNotes={versionCheck.releaseNotes}
        forceUpdate={versionCheck.forceUpdate}
        installing={versionCheck.installing}
        onUpdate={versionCheck.handleInstallUpdate}
        onCancel={versionCheck.handleCancelUpdate}
      />
    </VersionCheckContext.Provider>
  );
}

export function useVersionCheckContext() {
  const ctx = useContext(VersionCheckContext);
  if (!ctx) {
    throw new Error(
      'useVersionCheckContext must be used within VersionCheckProvider',
    );
  }
  return ctx;
}
