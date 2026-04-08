import { useState, useEffect, useCallback } from 'react'
import type { WatchlistItem } from '../../types/index'
import { TEXTAREA_CLASS } from '../Forms/formUtils'

interface EditNoteModalProps {
  readonly isOpen: boolean
  readonly item: WatchlistItem | null
  readonly onClose: () => void
  readonly onSave: (id: string, notes: string | null) => Promise<void>
}

export function EditNoteModal({ isOpen, item, onClose, onSave }: EditNoteModalProps) {
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen && item) {
      setNotes(item.notes ?? '')
      setIsSaving(false)
    }
  }, [isOpen, item])

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    if (!item) return

    setIsSaving(true)
    try {
      const trimmed = notes.trim()
      await onSave(item.id, trimmed || null)
      onClose()
    } catch {
      setIsSaving(false)
    }
  }, [item, notes, onSave, onClose])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !item) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-sv-elevated rounded-lg w-full max-w-sm mx-4 shadow-xl border border-sv-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sv-border">
          <h2 className="text-lg font-semibold text-sv-text">
            Note for <span className="text-sv-accent font-mono">{item.ticker}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-sv-text-muted hover:text-sv-text transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Add a note about this ticker..."
            className={TEXTAREA_CLASS}
            autoFocus
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-sv-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-sv-text-secondary hover:text-sv-text bg-sv-surface border border-sv-border rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white rounded-md bg-sv-accent hover:bg-sv-accent/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
