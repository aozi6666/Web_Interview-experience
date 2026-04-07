import { createStyles } from 'antd-style';

export const useNavBarStyles = createStyles(() => ({
  navbar: {
    width: '88px',
    height: '100%',
    background: 'rgba(15, 15, 15, 1)',
    display: 'flex',
    flexDirection: 'column',
    // borderRight: '1px solid #333',
    position: 'relative',
    zIndex: 100,

    '@media (max-width: 768px)': {
      width: '88px',
    },
  },

  navbarHeader: {
    padding: '20px 0',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '80px',
  },

  navbarLogo: {
    fontSize: '24px',
    cursor: 'pointer',
    transition: 'color 0.3s ease',
    color: '#00d4aa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',

    '&:hover': {
      color: '#00d4aa',
    },
  },
  navbarLogoImg: {
    width: '100%',
    height: '100%',
  },

  navbarMenu: {
    flex: 1,
    padding: '10px 0',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    overflowY: 'auto',

    // @media 情况下保持和正常情况一样的间距
    '@media (max-width: 768px)': {
      gap: '16px',
      paddingTop: '18px',
      // paddingBottom: '125px',
    },

    '&::-webkit-scrollbar': {
      width: '4px',
    },

    '&::-webkit-scrollbar-track': {
      background: 'transparent',
    },

    '&::-webkit-scrollbar-thumb': {
      background: '#333',
      borderRadius: '2px',

      '&:hover': {
        background: '#555',
      },
    },
  },

  navbarMenuSeparator: {
    width: '16px',
    height:'2px',
    borderRadius: '8px',
    background: 'rgba(55, 59, 57, 1) !important',
  },

  navbarFooter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  avatarContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
  },

  bottomMenu: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    paddingBottom: '8px',
  },

  modeSwitcherContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '0 6px',
    marginBottom: '6px',
  },
}));
