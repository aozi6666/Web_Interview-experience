/*
Modal 核心：
    - 父组件控制开关 open(布尔) : 子组件根据 open 决定“显示 / 关闭 / 动画 / 销毁”
    - 点击遮罩关闭
    - 点击内容区不关闭
    - 用 Portal 把弹窗挂到 document.body 上
    - 有过渡动画
    - 关闭时不要立刻销毁，不然动画来不及播完
*/ 
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function App() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setOpen(true)}>打开弹窗</button>

      <Modal
        open={open}  // "开关状态”
        onClose={() => setOpen(false)} // 回调函数：
        destroyOnClose={true}   // 关掉之后，动画播完 要不要把节点 彻底删除
      >
        <h3>Modal 标题</h3>
        <p>这是一个带动画和销毁时机控制的受控弹窗。</p>
      </Modal>
    </div>
  );
}

export default function Modal({
  open,
  onClose,
  destroyOnClose = true,
  children,
}) {
  // 控制“弹窗 DOM是否还挂载在页面上”
  const [mounted, setMounted] = useState(open);
  // “当前是 “显示态”（进入态）还是“隐藏态”（退出态）
  // 控制：透明度、缩放、位移、遮罩深浅
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      // 1）打开：先挂载（把弹窗节点放到页面里），再进入动画
      setMounted(true);

      // 2）RAF:让浏览器先 渲染初始状态，再切到 visible，动画才能生效
      // 为了让动画生效: 不要立刻显示，等浏览器先渲染一帧，再切到显示状态
      requestAnimationFrame(() => {
        setVisible(true);
      });
    } else {
      // 关闭：先播退出动画,没有立刻销毁
      // 先进入"隐藏态"，开始播放退出动画
      setVisible(false);
    }
  }, [open]);

  // 正在删除 DOM 节点
  const handleTransitionEnd = () => {
    // 只有在“关闭状态”下，动画结束后才进入下一步销毁
    if (!open && destroyOnClose) {
      setMounted(false);  // 销毁 DOM
    }
  };

  // 已关闭且需要销毁，并且动画也播完了 => 不渲染任何DOM（消失）
  if (!mounted) return null;

  // Portal(门户，大门): return createPortal(..., document.body)-弹窗浮层

  return createPortal(
    <div
      className={`modal-mask ${visible ? "modal-mask-show" : "modal-mask-hide"}`}
      onClick={onClose}
      onTransitionEnd={handleTransitionEnd}
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 1000ms ease", //平滑变化
        background: visible ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0)",
      }}
    >
      <div
        className={`modal-content ${visible ? "modal-content-show" : "modal-content-hide"}`}
        onClick={(e) => e.stopPropagation()}  // 阻止事件冒泡，点击内容区不关闭
        style={{
          width: 400,
          padding: 20,
          borderRadius: 12,
          background: "#fff",
          /*   
            弹窗阴影：
            1）打开时：透明度opacity变成 1、位移translateY回到原位、缩放scale回到正常
            2）关闭时：透明度opacity变成 0、位移translateY下移20px、缩放scale到 0.9s
          */
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.9)",
          opacity: visible ? 1 : 0,
          transition: "all 300ms ease",
        }}
      >
        {children}

        <div style={{ marginTop: 16, textAlign: "right" }}>
          <button onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
