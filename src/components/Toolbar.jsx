import Tip from './Tip'

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

function HighlighterIcon({ active, color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
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

  const btn = (t, label, icon) => (
    <Tip label={label} side="right">
      <button onClick={() => setTool(t)}
        style={{ width:40, height:40, borderRadius:8, border:'none', background: tool===t ? '#457b9d' : 'transparent', color: tool===t ? '#fff' : '#333', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {icon}
      </button>
    </Tip>
  )

  const fmtBtn = (label, active, onClick, children, disabled = false) => (
    <Tip label={label} side="right">
      <button type="button" onClick={onClick} disabled={disabled}
        style={{
          width: 40, height: 26, borderRadius: 6, border: 'none',
          background: active ? '#457b9d' : 'transparent',
          color: active ? '#fff' : '#333',
          fontSize: 14, fontWeight: 700, fontStyle: 'normal', textDecoration: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer',
        }}>
        {children}
      </button>
    </Tip>
  )

  const activeColors = tool === 'draw' && highlight ? HIGHLIGHT_COLORS : COLORS
  const activeColorNames = tool === 'draw' && highlight ? HIGHLIGHT_NAMES : COLOR_NAMES
  const canToggleStyle = tool === 'text' || tool === 'sticky'

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'12px 6px', background:'#fff', borderRight:'1px solid #e5e5e5', zIndex:10 }}>
      {btn('draw', 'Draw', '✏️')}
      {btn('erase', 'Eraser', '🧹')}
      {btn('text', 'Text box', 'T')}
      {btn('sticky', 'Sticky note', '📝')}
      {btn('select', 'Select & move', '☝️')}

      <div style={{ height:1, width:28, background:'#e5e5e5', margin:'4px 0' }} />

      {tool === 'draw' && (
        <Tip label={highlight ? 'Switch to pen' : 'Switch to highlighter'} side="right">
          <button onClick={() => setHighlight(v => !v)}
            style={{ width:40, height:40, borderRadius:8, border:'none', background: highlight ? '#fef9c3' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <HighlighterIcon active={highlight} color={highlightColor} />
          </button>
        </Tip>
      )}

      {!showTextFormat && (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {activeColors.map((c, i) => (
              <Tip key={c} label={activeColorNames[i]} side="right">
                <button onClick={() => setActiveColor(c)}
                  style={{ width:24, height:24, borderRadius:'50%', border: activeColor===c ? '2.5px solid #457b9d' : '1.5px solid #ccc', background:c, padding:0 }} />
              </Tip>
            ))}
            <Tip label="Custom color" side="right">
              <label style={{ width:24, height:24, borderRadius:'50%', border:'1.5px solid #ccc', background:'conic-gradient(from 0deg, #e63946, #f4a261, #f6c90e, #2a9d8f, #457b9d, #6a4c93, #e63946)', cursor:'pointer', display:'block', position:'relative', overflow:'hidden', flexShrink:0 }}>
                <input type="color" onChange={e => setActiveColor(e.target.value)}
                  style={{ position:'absolute', opacity:0, width:'150%', height:'150%', left:'-25%', top:'-25%', cursor:'pointer' }} />
              </label>
            </Tip>
          </div>

          <div style={{ height:1, width:28, background:'#e5e5e5', margin:'4px 0' }} />

          {WIDTHS.map((w, i) => (
            <Tip key={w} label={WIDTH_LABELS[i]} side="right">
              <button onClick={() => setWidth(w)}
                style={{ width:28, height:20, borderRadius:4, border:'none', background: width===w ? '#457b9d' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ width:16, height: w>10?8:w>4?4:2, background: width===w ? '#fff' : '#888', borderRadius:2 }} />
              </button>
            </Tip>
          ))}
        </>
      )}

      {showTextFormat && (
        <>
          <div style={{ fontSize: 9, color: '#888', textAlign: 'center', lineHeight: 1.2, maxWidth: 48, marginBottom: 2 }}>
            {formatHint}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {activeColors.map((c, i) => (
              <Tip key={c} label={activeColorNames[i]} side="right">
                <button onClick={() => setActiveColor(c)}
                  style={{ width:24, height:24, borderRadius:'50%', border: activeColor===c ? '2.5px solid #457b9d' : '1.5px solid #ccc', background:c, padding:0 }} />
              </Tip>
            ))}
            <Tip label="Custom color" side="right">
              <label style={{ width:24, height:24, borderRadius:'50%', border:'1.5px solid #ccc', background:'conic-gradient(from 0deg, #e63946, #f4a261, #f6c90e, #2a9d8f, #457b9d, #6a4c93, #e63946)', cursor:'pointer', display:'block', position:'relative', overflow:'hidden', flexShrink:0 }}>
                <input type="color" onChange={e => setActiveColor(e.target.value)}
                  style={{ position:'absolute', opacity:0, width:'150%', height:'150%', left:'-25%', top:'-25%', cursor:'pointer' }} />
              </label>
            </Tip>
          </div>

          <div style={{ height:1, width:28, background:'#e5e5e5', margin:'4px 0' }} />

          {fmtBtn('Bold (Ctrl+B)', bold, onToggleBold, <span style={{ fontWeight: 700 }}>B</span>, !canToggleStyle)}
          {fmtBtn('Italic (Ctrl+I)', italic, onToggleItalic, <span style={{ fontStyle: 'italic', fontWeight: 400 }}>I</span>, !canToggleStyle)}
          {fmtBtn('Underline (Ctrl+U)', underline, onToggleUnderline, <span style={{ textDecoration: 'underline', fontWeight: 400 }}>U</span>, !canToggleStyle)}

          {showFontPicker && (
            <>
              <div style={{ height:1, width:28, background:'#e5e5e5', margin:'4px 0' }} />
              {FONTS.map(f => (
                <Tip key={f.value} label={f.label} side="right">
                  <button onClick={() => setFontFamily(f.value)}
                    style={{ width:40, height:26, borderRadius:6, border:'none', background: fontFamily===f.value ? '#457b9d' : 'transparent', color: fontFamily===f.value ? '#fff' : '#333', fontSize:14, fontFamily:f.value, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    Aa
                  </button>
                </Tip>
              ))}
            </>
          )}

          <div style={{ height:1, width:28, background:'#e5e5e5', margin:'4px 0' }} />
          {[['left','⬅','Align left'], ['center','↔','Align center'], ['right','➡','Align right']].map(([align, icon, label]) => (
            <Tip key={align} label={label} side="right">
              <button onClick={() => setTextAlign(align)}
                style={{ width:40, height:26, borderRadius:6, border:'none', background: textAlign===align ? '#457b9d' : 'transparent', color: textAlign===align ? '#fff' : '#333', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {icon}
              </button>
            </Tip>
          ))}
          <div style={{ height:1, width:28, background:'#e5e5e5', margin:'4px 0' }} />
          {[['none','¶','No list'], ['bullet','•','Bullet list'], ['numbered','1.','Numbered list']].map(([ls, icon, label]) => (
            <Tip key={ls} label={label} side="right">
              <button onClick={() => setListStyle(ls)}
                style={{ width:40, height:26, borderRadius:6, border:'none', background: listStyle===ls ? '#457b9d' : 'transparent', color: listStyle===ls ? '#fff' : '#333', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {icon}
              </button>
            </Tip>
          ))}
        </>
      )}
    </div>
  )
}
