import { useSiderIconStyles } from './styles';

interface SiderIconProps {
  isActive: boolean;
  isHovered: boolean;
  normalIcon: string;
  activeIcon: string;
  size: number;
}

function SiderIcon({
  isActive,
  isHovered,
  normalIcon,
  activeIcon,
  size,
}: SiderIconProps) {
  const { styles } = useSiderIconStyles();
  // 当处于激活状态或悬停状态时显示高亮图标
  const iconSrc = isActive || isHovered ? activeIcon : normalIcon;

  return (
    <img
      src={iconSrc}
      alt="icon"
      width={size}
      height={size}
      className={styles.icon}
    />
  );
}

export default SiderIcon;
