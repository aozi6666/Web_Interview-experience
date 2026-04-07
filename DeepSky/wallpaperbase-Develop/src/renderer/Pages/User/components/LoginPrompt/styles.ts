import { createStyles } from 'antd-style';

export const useLoginPromptStyles = createStyles(() => ({
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flex: 1,
  },

  content: {
    background: 'rgba(40, 40, 40, 1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '10px',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '64px',
    width: '100%',
    height: '100%',
  },

  appIconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
  },

  appIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 25px rgba(255, 107, 107, 0.3)',
  },

  appIconText: {
    fontSize: '40px',
    lineHeight: '1',
  },

  loginPrompt: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    textAlign: 'center',
    marginBottom: '20px',
  },

  promptTitle: {
    color: '#ffffff',
    fontSize: '28px',
    fontWeight: '600',
    margin: '0',
    lineHeight: '1.2',
  },

  promptMessage: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '16px',
    lineHeight: '1.5',
    margin: '0',
    maxWidth: '280px',
  },

  actionContainer: {
    width: '112px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '16px',
  },

  loginButton: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #00d4aa 0%, #00a085 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    outline: 'none',
    boxShadow: '0 4px 15px rgba(0, 212, 170, 0.3)',
    textDecoration: 'none',

    '&:hover': {
      background: 'linear-gradient(135deg, #00a085 0%, #008a6f 100%)',
      transform: 'translateY(-2px)',
      boxShadow: '0 6px 20px rgba(0, 212, 170, 0.4)',
    },

    '&:active': {
      transform: 'translateY(0)',
      boxShadow: '0 2px 10px rgba(0, 212, 170, 0.3)',
    },

    '&:focus': {
      outline: '2px solid rgba(0, 212, 170, 0.5)',
      outlineOffset: '2px',
    },
  },
}));
