import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function HubPanel({ title, lead, embedded = false, children }) {
  if (embedded) {
    return <div className="wb-hub wb-hub--embedded">{children}</div>
  }
  return (
    <div className="wb-hub">
      <header className="wb-hub__intro">
        <h2 className="wb-hub__title">{title}</h2>
        {lead && <p className="wb-hub__lead">{lead}</p>}
      </header>
      {children}
    </div>
  )
}

export function HubAlert({ message }) {
  if (!message) return null
  return (
    <div className="wb-hub-alert" role="alert">
      {message}
    </div>
  )
}

export function HubEmpty({ title, description }) {
  return (
    <div className="wb-hub-empty">
      {title && <p className="wb-hub-empty__title">{title}</p>}
      {description && <p className="wb-hub-empty__desc">{description}</p>}
    </div>
  )
}

export function HubLoading({ label = 'Loading…' }) {
  return <p className="wb-hub-loading">{label}</p>
}

export function HubCreateRow({ children }) {
  return <div className="wb-hub-create">{children}</div>
}

export function HubToolbar({ children }) {
  return <div className="wb-hub-toolbar">{children}</div>
}

export function HubBackButton({ onClick, label = 'Back' }) {
  return (
    <button type="button" className="wb-hub-back" onClick={onClick}>
      ← {label}
    </button>
  )
}

export function HubCardList({ children, className = '' }) {
  return <ul className={`wb-hub-card-list ${className}`.trim()}>{children}</ul>
}

export function HubCard({ children, className = '', as: Tag = 'li' }) {
  return <Tag className={`wb-hub-card ${className}`.trim()}>{children}</Tag>
}

export function HubButton({ className = '', variant = '', ...props }) {
  const v = variant ? ` wb-hub-btn--${variant}` : ''
  return <button type="button" className={`wb-hub-btn${v} ${className}`.trim()} {...props} />
}

export function HubOverflowMenu({ items, label = 'More actions', placement = 'below' }) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return

    const rect = trigger.getBoundingClientRect()
    const menuHeight = menu.offsetHeight
    const menuWidth = menu.offsetWidth || 160
    const gap = 6
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top

    let openAbove = placement === 'above'
    if (openAbove && spaceAbove < menuHeight + gap && spaceBelow >= spaceAbove) {
      openAbove = false
    } else if (!openAbove && spaceBelow < menuHeight + gap && spaceAbove > spaceBelow) {
      openAbove = true
    }

    const top = openAbove ? rect.top - menuHeight - gap : rect.bottom + gap
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))

    setMenuStyle({
      position: 'fixed',
      top: Math.max(8, top),
      left,
      minWidth: 160,
      zIndex: 5000,
    })
  }, [placement])

  useEffect(() => {
    if (!open) {
      setMenuStyle(null)
      return
    }

    positionMenu()
    const frame = requestAnimationFrame(positionMenu)

    const onOutside = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (menuRef.current?.contains(e.target)) return
      setOpen(false)
    }

    const onReposition = () => positionMenu()

    document.addEventListener('mousedown', onOutside)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('mousedown', onOutside)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, positionMenu, items])

  const menu = open && createPortal(
    <div
      ref={menuRef}
      className="wb-hub-overflow__menu wb-hub-overflow__menu--portal"
      style={menuStyle || { position: 'fixed', visibility: 'hidden', top: 0, left: 0 }}
      role="menu"
    >
      {items.map(item => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={`wb-hub-overflow__item${item.danger ? ' wb-hub-overflow__item--danger' : ''}`}
          onClick={() => {
            setOpen(false)
            item.onClick()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )

  return (
    <div className={`wb-hub-overflow${open ? ' wb-hub-overflow--open' : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className="wb-hub-overflow__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation()
          setOpen(o => !o)
        }}
      >
        ⋯
      </button>
      {menu}
    </div>
  )
}

export function HubPanelBlock({ title, children, className = '' }) {
  return (
    <section className={`wb-hub-block ${className}`.trim()}>
      {title && <h3 className="wb-hub-block__title">{title}</h3>}
      {children}
    </section>
  )
}

export function HubChip({ selected, variant, className = '', children, ...props }) {
  let cls = 'wb-hub-chip'
  if (selected) cls += variant === 'warn' ? ' wb-hub-chip--warn' : ' wb-hub-chip--active'
  return (
    <button type="button" className={`${cls} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}

export function HubFileButton({ children, accept, onChange, className = '' }) {
  return (
    <label className={`wb-hub-btn wb-hub-file-btn ${className}`.trim()}>
      {children}
      <input type="file" accept={accept} onChange={onChange} />
    </label>
  )
}
