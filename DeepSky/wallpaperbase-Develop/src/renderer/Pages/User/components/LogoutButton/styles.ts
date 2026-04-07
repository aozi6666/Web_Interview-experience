import { createStyles } from 'antd-style';

export const useLogoutButtonStyles = createStyles(() => ({
  actionContainer: {
    width: '112px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '16px',
  },

  logoutButton: {
    width: '112px',
    padding: '8px 24px',
    gap: '1px',
    background: 'rgba(51, 51, 51, 1)',
    color: 'rgba(255, 90, 134, 1)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '400',
    cursor: 'pointer',
    outline: 'none',
    boxShadow: 'none',

    '&:hover': {
      boxShadow: 'none',
    },
  },
}));
