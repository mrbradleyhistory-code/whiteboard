import { useState } from 'react'

export default function Tip({ label, children, side = 'right' }) {
  const [show, setShow] = useState(false)

  const pos = side === 'bottom'
    ? { top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' }
    : side === 'left'
    ? { right: 'calc(100% + 6px)', top: '50%', transform: 'translateY(-50%)' }
    : { left: 'calc(100% + 6px)', top: '50%', transform: 'translateY(-50%)' }

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}>
      {children}
      {show && label && (
        <div style={{
          position: 'absolute', ...pos,
          background: '#1a1a1a', color: '#fff',
          padding: '4px 8px', borderRadius: 5,
          fontSize: 12, whiteSpace: 'nowrap',
          zIndex: 9999, pointerEvents: 'none',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
        }}>
          {label}
        </div>
      )}
    </div>
  )
}
