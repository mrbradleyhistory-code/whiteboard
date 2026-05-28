import { useEffect, useState } from 'react'
import Tip from './Tip'
import PopoverMenu from './PopoverMenu'
import { colors, sizes } from '../uiTheme'

const COLORS = ['#1a1a1a','#e63946','#f4a261','#f6c90e','#2a9d8f','#457b9d','#6a4c93','#ffffff']
const HIGHLIGHT_COLORS = ['#f6c90e','#a8dadc','#b5ead7','#ffd6e0','#c3b1e1']
const WIDTHS = [2, 5, 10, 20]
const COLOR_NAMES = ['Black','Red','Orange','Yellow','Teal','Blue','Purple','White']
const FONTS = [
  { label: 'Sans',  value: 'system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Mono',  value: "'Courier New', monospace" },
  { label: 'Hand',  value: "'Brush Script MT', cursive" },
]
const HIGHLIGHT_NAMES = ['Yellow','Cyan','Mint','Pink','Lavender']
const WIDTH_LABELS = ['Thin','Medium','Thick','Extra thick']
const TEXT_SIZES = [14, 18, 22, 28, 36]
const TEXT_SIZE_LABELS = ['Small', 'Normal', 'Large', 'XL', 'Huge']
const ALIGN_OPTIONS = [['left', '⬅', 'Left'], ['center', '↔', 'Center'], ['right', '➡', 'Right']]
const LIST_OPTIONS = [['none', '¶', 'Plain text'], ['bullet', '•', 'Bullet list'], ['numbered', '1.', 'Numbered list']]

const TOOLS = [
  { id: 'draw', label: 'Draw', icon: '✏️' },
  { id: 'erase', label: 'Erase', icon: '🧹' },
  { id: 'text', label: 'Text', icon: 'T' },
  { id: 'sticky', label: 'Note', icon: '📝' },
  { id: 'select', label: 'Move', icon: '☝️' },
]

const compactBtn = {
  width: '100%',
  minHeight: 48,
  borderRadius: 10,
  border: `1px solid ${colors.border}`,
  background: '#f6f8fa',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  padding: '6px 4px',
}

function HighlighterIcon({ active, color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="4" y="3" width="14" height="10" rx="2"
        fill={active ? color + '55' : '#e8e8e8'}
        stroke={active ? color : '#bbb'} strokeWidth="1.5" />
      <path d="M7 13 L7 19 L11 21 L15 19 L15 13 Z"
        fill={active ? color + '88' : '#d5d5d5'}
        stroke={active ? color : '#bbb'} strokeWidth="1.2" strokeLinejoin="round" />
      <line x1="7" y1="7" x2="15" y2="7"
        stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
    </svg>
  )
}

function panelMode(tool, editingTextId, editingStickyId) {
  if (editingTextId) return 'text'
  if (editingStickyId) return 'sticky'
  if (tool === 'draw') return 'draw'
  if (tool === 'erase') return 'erase'
  if (tool === 'text') return 'text'
  if (tool === 'sticky') return 'sticky'
  if (tool === 'select') return 'select'
  return null
}

function ContextSection({ title, children }) {
  return (
    <section className="wb-tool-panel" style={{
      borderTop: `1px solid ${colors.border}`,
      padding: '10px 6px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: colors.textMuted,
        textAlign: 'center',
      }}>
        {title}
      </div>
      {children}
    </section>
  )
}

function ColorMenuGrid({ palette, paletteNames, value, onChange, onPick }) {
  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 36px)',
        gap: 8,
        justifyContent: 'center',
      }}>
        {palette.map((c, i) => (
          <button
            key={c}
            type="button"
            title={paletteNames[i]}
            onClick={() => { onChange(c); onPick?.() }}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: value === c ? `3px solid ${colors.accent}` : '2px solid #b8c0cc',
              background: c,
              padding: 0,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${colors.border}` }}>
        <label style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          flexShrink: 0,
          border: '2px solid #b8c0cc',
          background: 'conic-gradient(from 0deg, #e63946, #f4a261, #f6c90e, #2a9d8f, #457b9d, #6a4c93, #e63946)',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <input
            type="color"
            value={value}
            onChange={e => { onChange(e.target.value); onPick?.() }}
            style={{ position: 'absolute', opacity: 0, width: '150%', height: '150%', left: '-25%', top: '-25%', cursor: 'pointer' }}
          />
        </label>
        <span style={{ fontSize: 13, color: colors.textMuted, fontWeight: 500 }}>Custom color</span>
      </div>
    </>
  )
}

function CompactMenuTrigger({ open, toggle, label, children }) {
  return (
    <button type="button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog"
      style={{
        ...compactBtn,
        border: open ? `2px solid ${colors.accent}` : compactBtn.border,
        background: open ? colors.accentLight : compactBtn.background,
      }}>
      {children}
      <span style={{ fontSize: 10, fontWeight: 700, color: colors.text }}>{label}</span>
    </button>
  )
}

function OptionMenuList({ options, value, onChange, onPick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {options.map(([id, icon, name]) => (
        <button
          key={id}
          type="button"
          onClick={() => { onChange(id); onPick?.() }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: value === id ? colors.accent : '#f0f2f5',
            color: value === id ? '#fff' : colors.text,
            fontSize: 14,
            fontWeight: 600,
            minHeight: 44,
          }}
        >
          <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{icon}</span>
          <span>{name}</span>
        </button>
      ))}
    </div>
  )
}

function WidthMenuList({ value, onChange, onPick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {WIDTHS.map((w, i) => (
        <button
          key={w}
          type="button"
          onClick={() => { onChange(w); onPick?.() }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: value === w ? colors.accent : '#f0f2f5',
            color: value === w ? '#fff' : colors.text,
            fontSize: 14,
            fontWeight: 600,
            minHeight: 44,
          }}
        >
          <div style={{
            width: 32,
            height: w > 10 ? 10 : w > 4 ? 6 : 3,
            background: value === w ? '#fff' : '#888',
            borderRadius: 3,
            flexShrink: 0,
          }} />
          <span>{WIDTH_LABELS[i]}</span>
          <span style={{ marginLeft: 'auto', opacity: 0.7, fontSize: 12 }}>{w}px</span>
        </button>
      ))}
    </div>
  )
}

function TextSizeMenuList({ value, onChange, onPick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {TEXT_SIZES.map((sz, i) => (
        <button
          key={sz}
          type="button"
          onClick={() => { onChange(sz); onPick?.() }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: value === sz ? colors.accent : '#f0f2f5',
            color: value === sz ? '#fff' : colors.text,
            minHeight: 44,
          }}
        >
          <span style={{ fontSize: Math.min(sz, 28), fontWeight: 700, width: 36, lineHeight: 1 }}>Aa</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{TEXT_SIZE_LABELS[i]}</span>
          <span style={{ marginLeft: 'auto', opacity: 0.7, fontSize: 12 }}>{sz}px</span>
        </button>
      ))}
    </div>
  )
}

function FontMenuList({ value, onChange, onPick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {FONTS.map(f => (
        <button
          key={f.value}
          type="button"
          onClick={() => { onChange(f.value); onPick?.() }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: value === f.value ? colors.accent : '#f0f2f5',
            color: value === f.value ? '#fff' : colors.text,
            fontSize: 16,
            fontFamily: f.value,
            fontWeight: 600,
            minHeight: 44,
          }}
        >
          <span>Aa</span>
          <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>{f.label}</span>
        </button>
      ))}
    </div>
  )
}

function FormatStyleMenu({ bold, italic, underline, onToggleBold, onToggleItalic, onToggleUnderline }) {
  const toggleBtn = (active, onClick, label, child) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        flex: 1,
        minHeight: 48,
        borderRadius: 8,
        border: 'none',
        background: active ? colors.accent : '#f0f2f5',
        color: active ? '#fff' : colors.text,
        fontSize: 18,
        fontWeight: 700,
      }}
    >
      {child}
    </button>
  )
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {toggleBtn(bold, onToggleBold, 'Bold', <span style={{ fontWeight: 700 }}>B</span>)}
      {toggleBtn(italic, onToggleItalic, 'Italic', <span style={{ fontStyle: 'italic', fontWeight: 400 }}>I</span>)}
      {toggleBtn(underline, onToggleUnderline, 'Underline', <span style={{ textDecoration: 'underline', fontWeight: 400 }}>U</span>)}
    </div>
  )
}

function TextFormatControls({
  openMenu, setOpenMenu,
  showColor, showFont, showTextSize,
  formatHint, stickyHint,
  palette, paletteNames, activeColor, setActiveColor,
  fontSize, setFontSize,
  fontFamily, setFontFamily,
  textAlign, setTextAlign,
  listStyle, setListStyle,
  bold, italic, underline,
  onToggleBold, onToggleItalic, onToggleUnderline,
}) {
  const alignIcon = ALIGN_OPTIONS.find(([id]) => id === textAlign)?.[1] ?? '↔'
  const listIcon = LIST_OPTIONS.find(([id]) => id === listStyle)?.[1] ?? '¶'
  const styleActive = bold || italic || underline

  const menu = (id, minWidth, trigger, content) => (
    <PopoverMenu
      open={openMenu === id}
      onOpenChange={v => setOpenMenu(v ? id : null)}
      minWidth={minWidth}
      trigger={({ toggle }) => trigger({ open: openMenu === id, toggle })}
    >
      {content}
    </PopoverMenu>
  )

  return (
    <>
      {formatHint && (
        <p style={{ fontSize: 10, color: colors.textMuted, textAlign: 'center', lineHeight: 1.3, margin: 0 }}>
          {formatHint}
        </p>
      )}
      {stickyHint && (
        <p style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', lineHeight: 1.35, margin: 0 }}>
          {stickyHint}
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {showColor && menu('color', 220,
          ({ open, toggle }) => (
            <CompactMenuTrigger open={open} toggle={toggle} label="Color">
              <span style={{
                width: 28, height: 28, borderRadius: '50%', background: activeColor,
                border: '2px solid #fff', boxShadow: '0 0 0 1px #b8c0cc',
              }} />
            </CompactMenuTrigger>
          ),
          <ColorMenuGrid palette={palette} paletteNames={paletteNames} value={activeColor} onChange={setActiveColor} onPick={() => setOpenMenu(null)} />,
        )}
        {showTextSize && menu('textSize', 200,
          ({ open, toggle }) => (
            <CompactMenuTrigger open={open} toggle={toggle} label="Size">
              <span style={{ fontSize: Math.min(fontSize, 22), fontWeight: 700, lineHeight: 1 }}>Aa</span>
            </CompactMenuTrigger>
          ),
          <TextSizeMenuList value={fontSize} onChange={setFontSize} onPick={() => setOpenMenu(null)} />,
        )}
        {menu('format', 180,
          ({ open, toggle }) => (
            <CompactMenuTrigger open={open} toggle={toggle} label="Style">
              <span style={{
                fontSize: 16, fontWeight: bold ? 700 : 400,
                fontStyle: italic ? 'italic' : 'normal',
                textDecoration: underline ? 'underline' : 'none',
                color: styleActive ? colors.accent : colors.text,
              }}>B</span>
            </CompactMenuTrigger>
          ),
          <FormatStyleMenu bold={bold} italic={italic} underline={underline}
            onToggleBold={onToggleBold} onToggleItalic={onToggleItalic} onToggleUnderline={onToggleUnderline} />,
        )}
        {showFont && menu('font', 200,
          ({ open, toggle }) => (
            <CompactMenuTrigger open={open} toggle={toggle} label="Font">
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily, lineHeight: 1 }}>Aa</span>
            </CompactMenuTrigger>
          ),
          <FontMenuList value={fontFamily} onChange={setFontFamily} onPick={() => setOpenMenu(null)} />,
        )}
        {menu('align', 200,
          ({ open, toggle }) => (
            <CompactMenuTrigger open={open} toggle={toggle} label="Align">
              <span style={{ fontSize: 20, lineHeight: 1 }}>{alignIcon}</span>
            </CompactMenuTrigger>
          ),
          <OptionMenuList options={ALIGN_OPTIONS} value={textAlign} onChange={setTextAlign} onPick={() => setOpenMenu(null)} />,
        )}
        {menu('list', 220,
          ({ open, toggle }) => (
            <CompactMenuTrigger open={open} toggle={toggle} label="List">
              <span style={{ fontSize: 18, lineHeight: 1 }}>{listIcon}</span>
            </CompactMenuTrigger>
          ),
          <OptionMenuList options={LIST_OPTIONS} value={listStyle} onChange={setListStyle} onPick={() => setOpenMenu(null)} />,
        )}
      </div>
    </>
  )
}

export default function Toolbar({
  tool, setTool, color, setColor, highlightColor, setHighlightColor,
  width, setWidth, highlight, setHighlight,
  fontSize, setFontSize,
  textColor, setTextColor, fontFamily, setFontFamily,
  textAlign, setTextAlign, listStyle, setListStyle,
  editingTextId, editingStickyId,
  bold, italic, underline, onToggleBold, onToggleItalic, onToggleUnderline,
  formatHint,
}) {
  const [openMenu, setOpenMenu] = useState(null)
  const mode = panelMode(tool, editingTextId, editingStickyId)
  const isTextMode = mode === 'text'
  const isDrawMode = mode === 'draw'

  const activeColor = isTextMode ? textColor : isDrawMode && highlight ? highlightColor : color
  const palette = isDrawMode && highlight ? HIGHLIGHT_COLORS : COLORS
  const paletteNames = isDrawMode && highlight ? HIGHLIGHT_NAMES : COLOR_NAMES

  const setActiveColor = (c) => {
    if (isTextMode) setTextColor(c)
    else if (highlight) setHighlightColor(c)
    else setColor(c)
  }

  useEffect(() => { setOpenMenu(null) }, [mode, highlight])

  const toolBtn = (t, label, icon) => {
    const active = tool === t && !editingTextId && !editingStickyId
    return (
      <Tip key={t} label={label} side="right">
        <button type="button" onClick={() => setTool(t)}
          style={{
            width: '100%',
            minHeight: 52,
            borderRadius: 10,
            border: active ? `2px solid ${colors.accentDark}` : '2px solid transparent',
            background: active ? colors.accent : 'transparent',
            color: active ? '#fff' : colors.text,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            padding: '4px 2px',
          }}>
          <span style={{ fontSize: 24, lineHeight: 1 }} aria-hidden>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700 }}>{label}</span>
        </button>
      </Tip>
    )
  }

  const ColorMenuButton = () => (
    <PopoverMenu
      open={openMenu === 'color'}
      onOpenChange={v => setOpenMenu(v ? 'color' : null)}
      minWidth={220}
      trigger={({ toggle }) => (
        <CompactMenuTrigger open={openMenu === 'color'} toggle={toggle} label="Color">
          <span style={{
            width: 28, height: 28, borderRadius: '50%', background: activeColor,
            border: '2px solid #fff', boxShadow: '0 0 0 1px #b8c0cc',
          }} />
        </CompactMenuTrigger>
      )}
    >
      <ColorMenuGrid
        palette={palette}
        paletteNames={paletteNames}
        value={activeColor}
        onChange={setActiveColor}
        onPick={() => setOpenMenu(null)}
      />
    </PopoverMenu>
  )

  const WidthMenuButton = () => (
    <PopoverMenu
      open={openMenu === 'width'}
      onOpenChange={v => setOpenMenu(v ? 'width' : null)}
      minWidth={200}
      trigger={({ toggle }) => (
        <CompactMenuTrigger open={openMenu === 'width'} toggle={toggle} label="Size">
          <div style={{
            width: 28,
            height: Math.min(14, Math.max(3, width * 0.8)),
            background: colors.text,
            borderRadius: 3,
          }} />
        </CompactMenuTrigger>
      )}
    >
      <WidthMenuList value={width} onChange={setWidth} onPick={() => setOpenMenu(null)} />
    </PopoverMenu>
  )

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: sizes.toolbarWidth,
      minWidth: sizes.toolbarWidth,
      background: colors.surface,
      borderRight: `1px solid ${colors.border}`,
      zIndex: 10,
      overflowY: 'auto',
      overflowX: 'hidden',
      boxShadow: '2px 0 12px rgba(0,0,0,0.04)',
    }}>
      <div style={{ padding: '8px 6px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {TOOLS.map(({ id, label, icon }) => toolBtn(id, label, icon))}
      </div>

      {mode === 'draw' && (
        <ContextSection title={highlight ? 'Highlighter' : 'Pen'}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <Tip label="Pen" side="right">
              <button type="button" onClick={() => setHighlight(false)}
                style={{
                  minHeight: 44,
                  borderRadius: 8,
                  border: !highlight ? `2px solid ${colors.accent}` : `1px solid ${colors.border}`,
                  background: !highlight ? colors.accentLight : '#f6f8fa',
                  fontSize: 20,
                }}>✏️</button>
            </Tip>
            <Tip label="Highlighter" side="right">
              <button type="button" onClick={() => setHighlight(true)}
                style={{
                  minHeight: 44,
                  borderRadius: 8,
                  border: highlight ? '2px solid #ca8a04' : `1px solid ${colors.border}`,
                  background: highlight ? '#fef9c3' : '#f6f8fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <HighlighterIcon active={highlight} color={highlightColor} />
              </button>
            </Tip>
          </div>
          <ColorMenuButton />
          <WidthMenuButton />
        </ContextSection>
      )}

      {mode === 'erase' && (
        <ContextSection title="Eraser">
          <p style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', lineHeight: 1.35, margin: 0 }}>
            Drag over ink to erase
          </p>
          <WidthMenuButton />
        </ContextSection>
      )}

      {mode === 'text' && (
        <ContextSection title={editingTextId ? 'Edit text' : 'Text'}>
          <TextFormatControls
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            showColor
            showFont
            showTextSize
            formatHint={formatHint}
            palette={COLORS}
            paletteNames={COLOR_NAMES}
            activeColor={textColor}
            setActiveColor={setTextColor}
            fontSize={fontSize}
            setFontSize={setFontSize}
            fontFamily={fontFamily}
            setFontFamily={setFontFamily}
            textAlign={textAlign}
            setTextAlign={setTextAlign}
            listStyle={listStyle}
            setListStyle={setListStyle}
            bold={bold}
            italic={italic}
            underline={underline}
            onToggleBold={onToggleBold}
            onToggleItalic={onToggleItalic}
            onToggleUnderline={onToggleUnderline}
          />
        </ContextSection>
      )}

      {mode === 'sticky' && (
        <ContextSection title={editingStickyId ? 'Edit note' : 'Sticky note'}>
          <TextFormatControls
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            stickyHint="Tap canvas to place · change note color on the note"
            formatHint={formatHint}
            palette={COLORS}
            paletteNames={COLOR_NAMES}
            activeColor={textColor}
            setActiveColor={setTextColor}
            fontSize={fontSize}
            setFontSize={setFontSize}
            fontFamily={fontFamily}
            setFontFamily={setFontFamily}
            textAlign={textAlign}
            setTextAlign={setTextAlign}
            listStyle={listStyle}
            setListStyle={setListStyle}
            bold={bold}
            italic={italic}
            underline={underline}
            onToggleBold={onToggleBold}
            onToggleItalic={onToggleItalic}
            onToggleUnderline={onToggleUnderline}
          />
        </ContextSection>
      )}

      {mode === 'select' && (
        <ContextSection title="Move">
          <p style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 1.45, margin: 0 }}>
            Drag items to move. Use corner handles to resize.
          </p>
        </ContextSection>
      )}
    </div>
  )
}
