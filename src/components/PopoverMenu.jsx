import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { colors } from '../uiTheme'

/**
 * Touch-friendly popover anchored to a trigger; renders in a portal so it isn't clipped.
 */
export default function PopoverMenu({ open, onOpenChange, trigger, children, minWidth = 200 }) {
  const anchorRef = useRef(null)
  const menuRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const updatePosition = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 10
    let top = r.top
    let left = r.right + gap
    const menuH = menuRef.current?.offsetHeight ?? 280
    const menuW = menuRef.current?.offsetWidth ?? minWidth
    if (top + menuH > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - menuH - 8)
    }
    if (left + menuW > window.innerWidth - 8) {
      left = Math.max(8, r.left - menuW - gap)
    }
    setPos({ top, left })
  }, [minWidth])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const id = requestAnimationFrame(updatePosition)

    const onOutside = (e) => {
      if (anchorRef.current?.contains(e.target)) return
      if (menuRef.current?.contains(e.target)) return
      onOpenChange(false)
    }
    window.addEventListener('mousedown', onOutside)
    window.addEventListener('touchstart', onOutside, { passive: true })
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('mousedown', onOutside)
      window.removeEventListener('touchstart', onOutside)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, onOpenChange, updatePosition])

  return (
    <>
      <div ref={anchorRef} style={{ display: 'block', width: '100%' }}>
        {trigger({ open, toggle: () => onOpenChange(!open) })}
      </div>
      {open && createPortal(
        <div
          ref={menuRef}
          role="dialog"
          className="wb-popover-menu"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            minWidth,
            padding: 12,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
            zIndex: 100001,
          }}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  )
}
