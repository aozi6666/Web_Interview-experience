import React from 'react';

interface OverlayModalProps {
  open: boolean;
  canEdit: boolean;
  onMaskClick: () => void;
  onClose: () => void;
  closeIcon: string;
  styles: Record<string, string>;
  panelStyle?: React.CSSProperties;
  children: React.ReactNode;
}

function OverlayModal({
  open,
  canEdit,
  onMaskClick,
  onClose,
  closeIcon,
  styles,
  panelStyle,
  children,
}: OverlayModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={styles.overlayMask} onClick={onMaskClick}>
      <div
        className={styles.overlayPanel}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.overlayClose}
          onClick={onClose}
          disabled={!canEdit}
        >
          <img src={closeIcon} alt="close" />
        </button>
        {children}
      </div>
    </div>
  );
}

export default OverlayModal;
