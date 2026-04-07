import { createStyles } from 'antd-style';

export const useUserStyles = createStyles(() => ({
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
}));
