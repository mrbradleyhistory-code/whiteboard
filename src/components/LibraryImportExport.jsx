import { useState } from 'react'
import {
  exportLibraryJson,
  formatImportPreview,
  libraryExportFilename,
  mergeLibraryImport,
  parseLibraryImport,
} from '../lessonLibraryExport'
import { HubAlert, HubButton, HubFileButton } from './hubUi'

export default function LibraryImportExport({
  blocks,
  blockTags,
  blockTagColors,
  libraryFolders,
  targetTemplates,
  lessons,
  onImport,
  saving,
}) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleExport = () => {
    setError('')
    setMessage('')
    const json = exportLibraryJson({
      blocks,
      blockTags,
      blockTagColors,
      libraryFolders,
      targetTemplates,
      lessons,
    })
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = libraryExportFilename()
    a.click()
    URL.revokeObjectURL(url)
    setMessage('Download started — share the JSON file with other teachers.')
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError('')
    setMessage('')

    let text
    try {
      text = await file.text()
    } catch {
      setError('Could not read that file.')
      return
    }

    const { data, preview, error: parseError } = parseLibraryImport(text)
    if (parseError) {
      setError(parseError)
      return
    }

    const summary = formatImportPreview(preview)
    const ok = window.confirm(
      `Add ${summary} to your library?\n\nExisting items stay — imported items get new IDs.`,
    )
    if (!ok) return

    const merged = mergeLibraryImport(
      { blocks, blockTags, blockTagColors, libraryFolders, targetTemplates, lessons },
      data,
    )

    const result = await onImport(merged)
    if (result?.error) {
      setError(result.error)
      return
    }

    const { added } = merged
    const addedParts = []
    if (added.activities) addedParts.push(`${added.activities} activit${added.activities === 1 ? 'y' : 'ies'}`)
    if (added.targetTemplates) {
      addedParts.push(`${added.targetTemplates} target template${added.targetTemplates === 1 ? '' : 's'}`)
    }
    if (added.lessons) addedParts.push(`${added.lessons} lesson${added.lessons === 1 ? '' : 's'}`)
    setMessage(`Imported ${addedParts.join(', ')}.`)
  }

  return (
    <div className="wb-library-io">
      <div className="wb-library-io__toolbar">
        <HubButton onClick={handleExport} disabled={saving}>
          Export library
        </HubButton>
        <HubFileButton accept=".json,application/json" onChange={handleImport} disabled={saving}>
          Import library
        </HubFileButton>
      </div>
      <p className="wb-hub-hint wb-library-io__hint">
        Export activities, target templates, and lesson plans as JSON to share with other teachers.
      </p>
      <HubAlert message={error} />
      {message && <p className="wb-hub-hint wb-library-io__success">{message}</p>}
    </div>
  )
}
