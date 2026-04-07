import { keyframes,CSSObject } from 'antd-style';
// 入场动画：从上方向下滑动并淡入
const slideIn = keyframes`
  0% {
    opacity: 0;
    transform: translateY(-50px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
`;

// 出场动画：向上滑动并淡出
const slideOut = keyframes`
  0% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-50px);
  }
`;

const styles = (): { [key: string]: CSSObject } => ({
    // 主容器
    content: {
      position: 'fixed' as const,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: '20px', // 通知之间的垂直间距
    },
    
    // 每个通知项
    notification: {
      position: 'relative' as const, // 改为相对定位，由父容器控制位置
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      opacity: 0, // 初始透明
      zIndex: 9999,
      animation: `${slideIn} 0.5s ease-out forwards`,
      width: 'auto',
      maxWidth: '408px',
      height: '64px',
      borderRadius: '999px',
      border: '1px solid rgba(157, 157, 157, 1)',
      boxSizing: 'border-box',
      background: 'rgba(77, 77, 77, 1)',
      transform: 'translateY(-50px)', // 初始位置在上方

      '&[data-exiting="true"]': {
        animation: `${slideOut} 0.5s ease-out forwards`,
      },
    },
    
    icon: {
      fontSize: '20px',
      flexShrink: 0,
      marginLeft: '24px',
    },
    
    message: {
      fontSize: '20px',
      lineHeight: '1.5',
      color: 'rgba(255, 255, 255, 1)',
      marginRight: '24px',
      whiteSpace: 'nowrap' as const, // 不换行
      overflow: 'hidden',
      // textOverflow: 'ellipsis', // 超长文本显示省略号
      userSelect: 'none',
      WebkitUserSelect: 'none',
    },
});
export default styles;