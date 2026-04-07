import { createStyles } from 'antd-style';

export const useUserProfileStyles = createStyles(() => ({
  avatarContainer: {
    display: 'flex',
    gap: '15px',
  },

  avatar: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #00d4aa 0%, #00a085 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    border: '3px solid rgba(0, 212, 170, 0.3)',
    boxShadow: '0 10px 30px rgba(0, 212, 170, 0.2)',
  },

  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '50%',
  },

  avatarText: {
    color: '#ffffff',
    fontSize: '40px',
    fontWeight: '600',
    lineHeight: '1',
    textTransform: 'uppercase',
    userSelect: 'none',
  },

  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    textAlign: 'left',
  },

  userName: {
    color: '#ffffff',
    fontSize: '20px',
    margin: '0',
    lineHeight: '1.2',
  },

  userAccount: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '16px',
    margin: '0',
    lineHeight: '1.4',
  },
}));
