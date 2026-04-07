import { createStyles } from 'antd-style';

export const useMenuItemStyles = createStyles(() => ({
  menuItem: {
    width: '80px',
    height: '61px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'color 0.3s ease',
    position: 'relative',
    color: '#999',
    padding: '8px 4px',
    gap: '4px',

    '&:hover': {
      color: '#00d4aa',
    },

    '&.active': {
      color: '#00d4aa',
    },

    '&.logout': {
      color: '#999',

      '&:hover': {
        color: '#00d4aa',
      },
    },

  },

  menuIcon: {
    fontSize: '24px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',

    '& svg': {
      width: '24px',
      height: '24px',
    },

  },

  menuText: {
    fontSize: '15px',
    lineHeight: '25px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '72px',
    color: 'inherit',

  },
}));
