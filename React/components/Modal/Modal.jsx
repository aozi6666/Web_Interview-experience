import React from "react";
import { createPortal } from "react-dom";

function Modal({ open, onClose, destroyOnClose = false, children }) {
  // 关闭且需要销毁：直接不渲染
  if (!open && destroyOnClose) return null;

  const modalNode = (
    <div
      style={{
        display: open ? "flex" : "none",
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 300,
          padding: 20,
          background: "#fff",
          borderRadius: 8,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
        <div style={{ marginTop: 16 }}>
          <button onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}

export default Modal;
