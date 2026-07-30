import { Pencil, Trash2 } from 'lucide-react'

function RecordActions({ editLabel, deleteLabel, onEdit, onDelete, disabled = false }) {
  return (
    <div className="record-actions">
      <button className="icon-btn" disabled={disabled} onClick={onEdit} title={editLabel} type="button" aria-label={editLabel}>
        <Pencil size={16} />
      </button>
      <button className="icon-btn danger" disabled={disabled} onClick={onDelete} title={deleteLabel} type="button" aria-label={deleteLabel}>
        <Trash2 size={16} />
      </button>
    </div>
  )
}

export default RecordActions
