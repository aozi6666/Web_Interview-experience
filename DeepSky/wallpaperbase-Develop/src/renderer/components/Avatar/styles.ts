import { createStyles } from 'antd-style';

interface StyleProps {
  size: number;
}

export const useAvatarStyles = createStyles(
  ({ css }, { size }: StyleProps) => ({
    avatar: css`
      position: relative;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        transform: scale(1.05);
      }

      &:focus {
        outline: 2px solid #00d4aa;
        outline-offset: 2px;
      }
    `,

    avatarContent: css`
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: linear-gradient(135deg, #00d4aa 0%, #00a085 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
      border: 2px solid rgba(0, 212, 170, 0.3);
      transition: all 0.3s ease;

      &:hover {
        border-color: #00d4aa;
        box-shadow: 0 0 20px rgba(0, 212, 170, 0.4);
      }
    `,
    noravatarContent: css`
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(55, 59, 57, 1);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
      transition: all 0.3s ease;

      &:hover {
        box-shadow: 0 0 20px rgba(0, 212, 170, 0.4);
        background: rgba(68, 73, 71, 1);
      }
    `,

    avatarImage: css`
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    `,

    avatarText: css`
      color: #ffffff;
      font-size: ${Math.max(size * 0.4, 12)}px;
      font-weight: 600;
      line-height: 1;
      text-transform: uppercase;
      user-select: none;
    `,

    loginIcon: css`
      color: #ffffff;
      font-size: ${Math.max(size * 0.5, 16)}px;
      line-height: 1;
      user-select: none;
    `,
    loginText: css`
      color: #ffffff;
      font-size: ${Math.max(size * 0.25, 11)}px;
      font-weight: 500;
      line-height: 1.2;
      user-select: none;
      white-space: nowrap;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    `,

    onlineIndicator: css`
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: ${Math.max(size * 0.25, 8)}px;
      height: ${Math.max(size * 0.25, 8)}px;
      background: #00ff88;
      border-radius: 50%;
      border: 2px solid rgba(15, 15, 15, 1);
      box-shadow: 0 0 6px rgba(0, 255, 136, 0.6);
    `,
  }),
);
