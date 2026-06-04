import { createPortal } from 'react-dom'
import { boardDeepLink } from '../boardDeepLink'
import Whiteboard from './Whiteboard'

export default function LessonRunnerBoard({
  session,
  board,
  panelMode,
  onPanelModeChange,
  injectRequest,
  onInjectHandled,
}) {
  if (!board?.id) return null

  const openNewTab = () => {
    window.open(boardDeepLink(board.id), '_blank', 'noopener,noreferrer')
  }

  const chrome = (
    <div className="wb-runner-board__chrome">
      <span className="wb-runner-board__title">{board.name || 'Whiteboard'}</span>
      <div className="wb-runner-board__actions">
        {panelMode === 'docked' && (
          <button
            type="button"
            className="wb-lesson-runner__btn wb-lesson-runner__btn--sm"
            onClick={() => onPanelModeChange('fullscreen')}
          >
            Fullscreen
          </button>
        )}
        {panelMode === 'fullscreen' && (
          <button
            type="button"
            className="wb-lesson-runner__btn wb-lesson-runner__btn--sm"
            onClick={() => onPanelModeChange('docked')}
          >
            Exit fullscreen
          </button>
        )}
        <button
          type="button"
          className="wb-lesson-runner__btn wb-lesson-runner__btn--sm"
          onClick={openNewTab}
        >
          New tab
        </button>
        <button
          type="button"
          className="wb-lesson-runner__btn wb-lesson-runner__btn--sm"
          onClick={() => onPanelModeChange('collapsed')}
        >
          Collapse
        </button>
      </div>
    </div>
  )

  const frame = (
    <div className="wb-runner-board__frame">
      <Whiteboard
        key={board.id}
        session={session}
        boardSummary={board}
        embedMode
        injectRequest={injectRequest}
        onInjectRequestHandled={onInjectHandled}
        onExitBoard={() => onPanelModeChange('collapsed')}
      />
    </div>
  )

  if (panelMode === 'collapsed') {
    return (
      <div className="wb-runner-board wb-runner-board--collapsed">
        <button
          type="button"
          className="wb-runner-board__collapsed-btn"
          onClick={() => onPanelModeChange('docked')}
        >
          <span className="wb-runner-board__collapsed-label">Show board</span>
          <span className="wb-runner-board__collapsed-name">{board.name}</span>
        </button>
        <button
          type="button"
          className="wb-lesson-runner__btn wb-lesson-runner__btn--sm"
          onClick={openNewTab}
        >
          New tab
        </button>
      </div>
    )
  }

  const panel = (
    <div className={`wb-runner-board wb-runner-board--${panelMode}`}>
      {chrome}
      {frame}
    </div>
  )

  if (panelMode === 'fullscreen') {
    return createPortal(panel, document.body)
  }

  return panel
}
