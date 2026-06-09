import { useState } from 'react'
import ActivityBlocksPanel from './ActivityBlocksPanel'
import LibraryImportExport from './LibraryImportExport'
import TargetTemplatesPanel from './TargetTemplatesPanel'
import { HubBackButton } from './hubUi'

const BANK_TABS = [
  { id: 'activities', label: 'Activities' },
  { id: 'outcomes', label: 'Targets & criteria' },
]

export default function TemplateBanksPanel({
  blocks,
  blockTags,
  blockTagColors,
  libraryFolders,
  targetTemplates,
  lessons,
  onSaveBlocks,
  onSaveTargetTemplates,
  onSaveFolders,
  onImportLibrary,
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
        <ActivityBlocksPanel
          blocks={blocks}
          blockTags={blockTags}
          blockTagColors={blockTagColors}
          libraryFolders={libraryFolders}
          onSaveBlocks={onSaveBlocks}
          onSaveFolders={onSaveFolders}
          saving={saving}
        />
      ) : (
        <TargetTemplatesPanel
          templates={targetTemplates}
          libraryFolders={libraryFolders}
          onSaveTemplates={onSaveTargetTemplates}
          onSaveFolders={onSaveFolders}
          saving={saving}
        />
      )}
      <LibraryImportExport
        blocks={blocks}
        blockTags={blockTags}
        blockTagColors={blockTagColors}
        libraryFolders={libraryFolders}
        targetTemplates={targetTemplates}
        lessons={lessons}
        onImport={onImportLibrary}
        saving={saving}
      />
    </div>
  )
}
