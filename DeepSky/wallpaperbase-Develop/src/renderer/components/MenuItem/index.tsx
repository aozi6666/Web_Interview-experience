import { JSX, KeyboardEvent, useState } from 'react';
import { useMenuItemStyles } from './styles';

interface MenuItemProps {
  item: {
    key: string;
    icon:
      | string
      | ((props: { isActive: boolean; isHovered: boolean }) => JSX.Element);
    label: string;
    path: string;
  };
  isActive: boolean;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

function MenuItem({ item, isActive, onClick, onKeyDown }: MenuItemProps) {
  const { styles, cx } = useMenuItemStyles();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={cx(styles.menuItem, { active: isActive })}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={item.label}
      role="button"
      tabIndex={0}
    >
      <span className={styles.menuIcon}>
        {typeof item.icon === 'function'
          ? item.icon({ isActive, isHovered })
          : item.icon}
      </span>
      <span className={styles.menuText}>{item.label}</span>
    </div>
  );
}

export default MenuItem;
