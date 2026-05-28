import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function Tip({ label, children, side = 'right' }) {
  const [show, setShow] = useState(false)
  const anchorRef = useRef(null)
  const [tipStyle, setTipStyle] = useState(null)

  const updatePosition = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 8
    if (side === 'bottom') {
      setTipStyle({
        top: r.bottom + gap,
        left: r.left + r.width / 2,
        transform: 'translateX(-50%)',
      })
    } else if (side === 'left') {
      setTipStyle({
        top: r.top + r.height / 2,
        left: r.left - gap,
        transform: 'translate(-100%, -50%)',
      })
    } else {
      setTipStyle({
        top: r.top + r.height / 2,
        left: r.right + gap,
        transform: 'translateY(-50%)',
      })
    }
  }, [side])

  useEffect(() => {
    if (!show) return
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [show, updatePosition])

  const open = () => {
    updatePosition()
    setShow(true)
  }

  return (
    <>
      <div
        ref={anchorRef}
        style={{ display: 'inline-flex' }}
        onMouseEnter={open}
        onMouseLeave={() => setShow(false)}
        onFocus={open}
        onBlur={() => setShow(false)}
      >
        {children}
      </div>
      {show && label && tipStyle && createPortal(
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            ...tipStyle,
            background: '#1a1a1a',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            zIndex: 100000,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.28)',
          }}
        >
          {label}
        </div>,
        document.body,
      )}
    </>
  )
}
