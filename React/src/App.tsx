import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import Modal from '../components/Modal/Modal.jsx'
import './App.css'

function App() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <p style={{ textAlign: 'center', marginTop: 24 }}>
          <button type="button" onClick={() => setOpen(true)}>
            打开 Modal 示例
          </button>
        </p>
      </section>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        destroyOnClose
      >
        <h3 style={{ marginTop: 0 }}>Modal 标题</h3>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          这是 App.tsx 里的用法示例：受控 <code>open</code>、点遮罩或底部按钮会调用{' '}
          <code>onClose</code>。内容区点击不会关闭（内部已 <code>stopPropagation</code>）。
        </p>
      </Modal>
    </>
  )
}

export default App
