import { RESIZE_HANDLES, resizeHandleStyle } from '../boardSelection'

export default function ResizeHandles({ onHandleDown, size }) {
  return RESIZE_HANDLES.map(handle => (
    <div
      key={handle}
      data-overlay-chrome
      data-resize-handle={handle}
      onPointerDown={e => {
        e.stopPropagation()
        onHandleDown(e, handle)
      }}
      style={resizeHandleStyle(handle, size)}
      role="presentation"
      aria-hidden
    />
  ))
}
