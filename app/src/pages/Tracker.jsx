import { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

const STATUSES = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected']

const STATUS_CLASS = {
  Saved: 'badge-saved',
  Applied: 'badge-applied',
  Interview: 'badge-interview',
  Offer: 'badge-offer',
  Rejected: 'badge-rejected',
}

const STATUS_EMOJI = {
  Saved: '🔖', Applied: '📤', Interview: '🗓️', Offer: '🎉', Rejected: '❌',
}

const BLANK_FORM = {
  company: '', role: '', jobUrl: '', status: 'Saved',
  dateApplied: '', notes: '',
}

function Modal({ title, onClose, onSubmit, form, setForm, editing }) {
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Company *</label>
            <input type="text" value={form.company} onChange={(e) => update('company', e.target.value)} placeholder="Google" />
          </div>
          <div className="form-group">
            <label>Role *</label>
            <input type="text" value={form.role} onChange={(e) => update('role', e.target.value)} placeholder="Senior Engineer" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Status</label>
            <select value={form.status} onChange={(e) => update('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Date Applied</label>
            <input type="date" value={form.dateApplied} onChange={(e) => update('dateApplied', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>Job URL</label>
          <input type="url" value={form.jobUrl} onChange={(e) => update('jobUrl', e.target.value)} placeholder="https://..." />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea
            className="notes-input"
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Recruiter name, salary discussed, next steps…"
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-gradient" onClick={onSubmit}>
            {editing ? 'Save Changes' : 'Add Application'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Tracker() {
  const [applications, setApplications] = useLocalStorage('hjh_applications', [])
  const [filter, setFilter] = useState('All')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(BLANK_FORM)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const apps = applications || []

  const stats = {
    total: apps.length,
    applied: apps.filter((a) => a.status === 'Applied').length,
    interview: apps.filter((a) => a.status === 'Interview').length,
    offer: apps.filter((a) => a.status === 'Offer').length,
    rejected: apps.filter((a) => a.status === 'Rejected').length,
  }

  const filtered = filter === 'All' ? apps : apps.filter((a) => a.status === filter)

  const openAdd = () => {
    setEditingId(null)
    setForm(BLANK_FORM)
    setShowModal(true)
  }

  const openEdit = (app) => {
    setEditingId(app.id)
    setForm({
      company: app.company || '',
      role: app.role || '',
      jobUrl: app.jobUrl || '',
      status: app.status || 'Saved',
      dateApplied: app.dateApplied || '',
      notes: app.notes || '',
    })
    setShowModal(true)
  }

  const handleSubmit = () => {
    if (!form.company.trim() || !form.role.trim()) return
    if (editingId) {
      setApplications(apps.map((a) => a.id === editingId ? { ...a, ...form } : a))
    } else {
      setApplications([
        { id: crypto.randomUUID(), dateAdded: new Date().toISOString(), ...form },
        ...apps,
      ])
    }
    setShowModal(false)
  }

  const handleDelete = (id) => {
    setApplications(apps.filter((a) => a.id !== id))
    setDeleteConfirm(null)
  }

  const getInitial = (company) => (company || '?')[0].toUpperCase()

  const formatDate = (dateStr) => {
    if (!dateStr) return null
    try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
    catch { return dateStr }
  }

  return (
    <div className="page-wide">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Application Tracker</h1>
          <p>Track every role. Know your pipeline at a glance.</p>
        </div>
        <button className="btn btn-gradient" onClick={openAdd}>+ Add Application</button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-number">{stats.applied}</div>
          <div className="stat-label">Applied</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-number">{stats.interview}</div>
          <div className="stat-label">Interviews</div>
        </div>
        <div className="stat-card green">
          <div className="stat-number">{stats.offer}</div>
          <div className="stat-label">Offers</div>
        </div>
        <div className="stat-card red">
          <div className="stat-number">{stats.rejected}</div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-row">
        {['All', ...STATUSES].map((s) => (
          <button
            key={s}
            className={`filter-chip${filter === s ? ' active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s !== 'All' && STATUS_EMOJI[s] + ' '}{s}
            {s !== 'All' && <span style={{ opacity: 0.7 }}> ({apps.filter((a) => a.status === s).length})</span>}
            {s === 'All' && <span style={{ opacity: 0.7 }}> ({apps.length})</span>}
          </button>
        ))}
      </div>

      {/* Applications list */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>{filter === 'All' ? 'No applications yet' : `No ${filter} applications`}</h3>
            <p>{filter === 'All' ? 'Click "Add Application" to start tracking.' : 'Change the filter to see others.'}</p>
          </div>
        </div>
      ) : (
        <div className="app-grid">
          {filtered.map((app) => (
            <div className="app-card" key={app.id}>
              <div className="app-logo">{getInitial(app.company)}</div>
              <div className="app-card-body">
                <div className="app-card-title">{app.role}</div>
                <div className="app-card-sub">{app.company}</div>
                <div className="app-card-meta">
                  <span className={`badge ${STATUS_CLASS[app.status]}`}>
                    {STATUS_EMOJI[app.status]} {app.status}
                  </span>
                  {app.dateApplied && (
                    <span className="text-muted text-small">Applied {formatDate(app.dateApplied)}</span>
                  )}
                  {app.jobUrl && (
                    <a
                      href={app.jobUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-small"
                      style={{ color: 'var(--primary)', textDecoration: 'none' }}
                    >
                      View Job ↗
                    </a>
                  )}
                  {app.notes && (
                    <span className="text-muted text-small" style={{ fontStyle: 'italic' }}>
                      {app.notes.slice(0, 60)}{app.notes.length > 60 ? '…' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="app-card-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(app)}>Edit</button>
                {deleteConfirm === app.id ? (
                  <>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(app.id)}>Confirm</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                  </>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(app.id)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal
          title={editingId ? 'Edit Application' : 'Add Application'}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          form={form}
          setForm={setForm}
          editing={!!editingId}
        />
      )}
    </div>
  )
}
