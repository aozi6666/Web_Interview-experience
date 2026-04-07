import { createStyles } from 'antd-style';

export const useAutoLaunchSettingsStyles = createStyles(() => ({
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

  settingItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'all 0.3s ease',

    '&:hover': {
      background: 'rgba(255, 255, 255, 0.08)',
      borderColor: 'rgba(255, 255, 255, 0.15)',
    },
  },

  settingInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
    marginRight: '16px',
  },

  settingLabel: {
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '500',
    lineHeight: '1.4',
  },

  settingDesc: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '13px',
    lineHeight: '1.4',
  },
}));
