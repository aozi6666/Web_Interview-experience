import { createStyles } from 'antd-style';

export const useVersionInfoStyles = createStyles(() => ({
  settingsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    width: '100%',
  },

  settingsTitle: {
    color: '#ffffff',
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 8px 0',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },

  versionContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    width: '100%',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },

  versionInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  versionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  versionLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '14px',
    fontWeight: '500',
  },

  versionValue: {
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
  },

  updateActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  updateButton: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #00d4aa 0%, #00a085 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    outline: 'none',
    boxShadow: '0 4px 15px rgba(0, 212, 170, 0.2)',

    '&:hover': {
      background: 'linear-gradient(135deg, #00a085 0%, #008a6f 100%)',
      transform: 'translateY(-2px)',
      boxShadow: '0 6px 20px rgba(0, 212, 170, 0.3)',
    },

    '&:active': {
      transform: 'translateY(0)',
      boxShadow: '0 2px 10px rgba(0, 212, 170, 0.2)',
    },

    '&:disabled': {
      opacity: 0.6,
      cursor: 'not-allowed',
      transform: 'none',
      boxShadow: '0 4px 15px rgba(0, 212, 170, 0.1)',
    },
  },
}));
