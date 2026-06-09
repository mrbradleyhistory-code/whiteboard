import { useState } from 'react'
import ActivityBlocksPanel from './ActivityBlocksPanel'
import TargetTemplatesPanel from './TargetTemplatesPanel'
import { HubBackButton } from './hubUi'

const BANK_TABS = [
  { id: 'activities', label: 'Activities' },
  { id: 'outcomes', label: 'Targets & criteria' },
]

export default function TemplateBanksPanel({
  blocks,
  blockTags,
  targetTemplates,
  onSaveBlocks,
  onSaveTargetTemplates,
  saving,
  onBack,
}) {
  const [bankTab, setBankTab] = useState('activities')

  return (
    <div>
      <HubBackButton onClick={onBack} label="Lessons" />
      <nav className="wb-template-banks__nav" aria-label="Template banks">
        {BANK_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`wb-template-banks__tab${bankTab === t.id ? ' wb-template-banks__tab--active' : ''}`}
            onClick={() => setBankTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {bankTab === 'activities' ? (
        <ActivityBlocksPanel blocks={blocks} blockTags={blockTags} onSaveBlocks={onSaveBlocks} saving={saving} />
      ) : (
        <TargetTemplatesPanel
          templates={targetTemplates}
          onSaveTemplates={onSaveTargetTemplates}
          saving={saving}
        />
      )}
    </div>
  )
}
