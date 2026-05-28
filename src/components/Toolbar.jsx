import Tip from './Tip'
import { colors, sizes, toolActiveStyle } from '../uiTheme'

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

const TOOLS = [
  { id: 'draw', label: 'Draw', icon: '✏️' },
  { id: 'erase', label: 'Erase', icon: '🧹' },
  { id: 'text', label: 'Text', icon: 'T' },
  { id: 'sticky', label: 'Note', icon: '📝' },
  { id: 'select', label: 'Move', icon: '☝️' },
]

function HighlighterIcon({ active, color }) {
  return (
    <svg width="26" height="26" viewBox="0 0 22 22" fill="none" aria-hidden>
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

const divider = { height: 1, width: '100%', maxWidth: 56, background: colors.border, margin: '6px 0' }

export default function Toolbar({
  tool, setTool, color, setColor, highlightColor, setHighlightColor,
  width, setWidth, highlight, setHighlight, fontSize, setFontSize,
  textColor, setTextColor, fontFamily, setFontFamily,
  textAlign, setTextAlign, listStyle, setListStyle,
  showTextFormat, showFontPicker,
  bold, italic, underline, onToggleBold, onToggleItalic, onToggleUnderline,
  formatHint,
}) {
  const activeColor = tool === 'text' ? textColor : highlight ? highlightColor : color

  const setActiveColor = (c) => {
    if (tool === 'text') setTextColor(c)
    else if (highlight) setHighlightColor(c)
    else setColor(c)
  }

  const toolBtn = (t, label, icon) => {
    const active = tool === t
    return (
      <Tip key={t} label={label} side="right">
        <button type="button" onClick={() => setTool(t)}
          style={{
            width: '100%',
            minHeight: sizes.touchComfort,
            borderRadius: 10,
            border: active ? `2px solid ${colors.accentDark}` : '2px solid transparent',
            background: active ? colors.accent : 'transparent',
            color: active ? '#fff' : colors.text,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            padding: '6px 4px',
          }}>
          <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden>{icon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.2 }}>{label}</span>
        </button>
      </Tip>
    )
  }

  const fmtBtn = (label, active, onClick, children, disabled = false) => (
    <Tip label={label} side="right">
      <button type="button" onClick={onClick} disabled={disabled}
        style={{
          width: '100%',
          minHeight: 40,
          borderRadius: 8,
          border: 'none',
          ...toolActiveStyle(active),
          background: active ? colors.accent : 'transparent',
          color: active ? '#fff' : colors.text,
          fontSize: 17,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : 1,
        }}>
        {children}
      </button>
    </Tip>
  )

  const colorBtn = (c, name) => (
    <Tip key={c} label={name} side="right">
      <button type="button" onClick={() => setActiveColor(c)}
        style={{
          width: sizes.colorSwatch,
          height: sizes.colorSwatch,
          borderRadius: '50%',
          border: activeColor === c ? `3px solid ${colors.accent}` : '2px solid #b8c0cc',
          background: c,
          padding: 0,
          boxShadow: activeColor === c ? '0 0 0 2px #fff inset' : 'none',
        }} />
    </Tip>
  )

  const activeColors = tool === 'draw' && highlight ? HIGHLIGHT_COLORS : COLORS
  const activeColorNames = tool === 'draw' && highlight ? HIGHLIGHT_NAMES : COLOR_NAMES
  const canToggleStyle = tool === 'text' || tool === 'sticky'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 4,
      width: sizes.toolbarWidth,
      minWidth: sizes.toolbarWidth,
      padding: '10px 8px',
      background: colors.surface,
      borderRight: `1px solid ${colors.border}`,
      zIndex: 10,
      overflowY: 'auto',
      overflowX: 'hidden',
      boxShadow: '2px 0 12px rgba(0,0,0,0.04)',
    }}>
      {TOOLS.map(({ id, label, icon }) => toolBtn(id, label, icon))}

      <div style={divider} />

      {tool === 'draw' && (
        <Tip label={highlight ? 'Pen' : 'Highlighter'} side="right">
          <button type="button" onClick={() => setHighlight(v => !v)}
            style={{
              width: '100%',
              minHeight: sizes.touchComfort,
              borderRadius: 10,
              border: highlight ? `2px solid #ca8a04` : '2px solid transparent',
              background: highlight ? '#fef9c3' : 'transparent',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}>
            <HighlighterIcon active={highlight} color={highlightColor} />
            <span style={{ fontSize: 11, fontWeight: 700, color: colors.text }}>Mark</span>
          </button>
        </Tip>
      )}

      {!showTextFormat && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '4px 0' }}>
            {activeColors.map((c, i) => colorBtn(c, activeColorNames[i]))}
            <Tip label="Custom color" side="right">
              <label style={{
                width: sizes.colorSwatch,
                height: sizes.colorSwatch,
                borderRadius: '50%',
                border: '2px solid #b8c0cc',
                background: 'conic-gradient(from 0deg, #e63946, #f4a261, #f6c90e, #2a9d8f, #457b9d, #6a4c93, #e63946)',
                cursor: 'pointer',
                display: 'block',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <input type="color" onChange={e => setActiveColor(e.target.value)}
                  style={{ position: 'absolute', opacity: 0, width: '150%', height: '150%', left: '-25%', top: '-25%', cursor: 'pointer' }} />
              </label>
            </Tip>
          </div>

          <div style={divider} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            {WIDTHS.map((w, i) => (
              <Tip key={w} label={WIDTH_LABELS[i]} side="right">
                <button type="button" onClick={() => setWidth(w)}
                  style={{
                    width: sizes.touchMin,
                    height: 36,
                    borderRadius: 8,
                    border: 'none',
                    background: width === w ? colors.accent : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <div style={{
                    width: 20,
                    height: w > 10 ? 10 : w > 4 ? 6 : 3,
                    background: width === w ? '#fff' : '#888',
                    borderRadius: 3,
                  }} />
                </button>
              </Tip>
            ))}
          </div>
        </>
      )}

      {showTextFormat && (
        <>
          <div style={{ fontSize: 10, color: colors.textMuted, textAlign: 'center', lineHeight: 1.3, padding: '0 4px 4px' }}>
            {formatHint}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            {activeColors.map((c, i) => colorBtn(c, activeColorNames[i]))}
            <Tip label="Custom color" side="right">
              <label style={{
                width: sizes.colorSwatch,
                height: sizes.colorSwatch,
                borderRadius: '50%',
                border: '2px solid #b8c0cc',
                background: 'conic-gradient(from 0deg, #e63946, #f4a261, #f6c90e, #2a9d8f, #457b9d, #6a4c93, #e63946)',
                cursor: 'pointer',
                display: 'block',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <input type="color" onChange={e => setActiveColor(e.target.value)}
                  style={{ position: 'absolute', opacity: 0, width: '150%', height: '150%', left: '-25%', top: '-25%', cursor: 'pointer' }} />
              </label>
            </Tip>
          </div>

          <div style={divider} />

          {fmtBtn('Bold', bold, onToggleBold, <span style={{ fontWeight: 700 }}>B</span>, !canToggleStyle)}
          {fmtBtn('Italic', italic, onToggleItalic, <span style={{ fontStyle: 'italic', fontWeight: 400 }}>I</span>, !canToggleStyle)}
          {fmtBtn('Underline', underline, onToggleUnderline, <span style={{ textDecoration: 'underline', fontWeight: 400 }}>U</span>, !canToggleStyle)}

          {showFontPicker && (
            <>
              <div style={divider} />
              {FONTS.map(f => (
                <Tip key={f.value} label={f.label} side="right">
                  <button type="button" onClick={() => setFontFamily(f.value)}
                    style={{
                      width: '100%',
                      minHeight: 40,
                      borderRadius: 8,
                      border: 'none',
                      ...toolActiveStyle(fontFamily === f.value),
                      background: fontFamily === f.value ? colors.accent : 'transparent',
                      color: fontFamily === f.value ? '#fff' : colors.text,
                      fontSize: 16,
                      fontFamily: f.value,
                    }}>
                    Aa
                  </button>
                </Tip>
              ))}
            </>
          )}

          <div style={divider} />
          {[['left','⬅','Left'], ['center','↔','Center'], ['right','➡','Right']].map(([align, icon, label]) => (
            <Tip key={align} label={label} side="right">
              <button type="button" onClick={() => setTextAlign(align)}
                style={{
                  width: '100%',
                  minHeight: 40,
                  borderRadius: 8,
                  border: 'none',
                  ...toolActiveStyle(textAlign === align),
                  background: textAlign === align ? colors.accent : 'transparent',
                  color: textAlign === align ? '#fff' : colors.text,
                  fontSize: 18,
                }}>
                {icon}
              </button>
            </Tip>
          ))}
          <div style={divider} />
          {[['none','¶','Plain'], ['bullet','•','Bullets'], ['numbered','1.','Numbers']].map(([ls, icon, label]) => (
            <Tip key={ls} label={label} side="right">
              <button type="button" onClick={() => setListStyle(ls)}
                style={{
                  width: '100%',
                  minHeight: 40,
                  borderRadius: 8,
                  border: 'none',
                  ...toolActiveStyle(listStyle === ls),
                  background: listStyle === ls ? colors.accent : 'transparent',
                  color: listStyle === ls ? '#fff' : colors.text,
                  fontSize: 16,
                }}>
                {icon}
              </button>
            </Tip>
          ))}
        </>
      )}
    </div>
  )
}
