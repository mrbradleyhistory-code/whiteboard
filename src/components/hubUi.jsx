import { useEffect, useRef, useState } from 'react'

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
  const rootRef = useRef(null)
  const placementClass = placement === 'above' ? ' wb-hub-overflow--above' : ''

  useEffect(() => {
    if (!open) return
    const onOutside = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  return (
    <div className={`wb-hub-overflow${placementClass}${open ? ' wb-hub-overflow--open' : ''}`} ref={rootRef}>
      <button
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
      {open && (
        <div className="wb-hub-overflow__menu" role="menu">
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
        </div>
      )}
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
