import { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

const INITIAL_PROFILE = {
  firstName: '', lastName: '', email: '', phone: '',
  location: '', linkedIn: '', portfolio: '',
  resume: '',
  skills: [{ name: '', level: 'Intermediate' }],
  preferences: {
    desiredRoles: '',
    industries: [],
    salaryMin: '', salaryMax: '',
    workTypes: [],
    jobTypes: [],
    locations: '',
  },
  toneEssay: '',
}

const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert']

const INDUSTRY_OPTIONS = [
  'Technology', 'Finance', 'Healthcare', 'Marketing', 'Design',
  'Education', 'Consulting', 'Media', 'Retail', 'Non-profit', 'Legal', 'Real Estate',
]

const WORK_TYPES = ['Remote', 'Hybrid', 'On-site']
const JOB_TYPES  = ['Full-time', 'Part-time', 'Contract', 'Freelance']

function CheckChip({ label, checked, onChange }) {
  return (
    <label className={`check-chip${checked ? ' checked' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  )
}

export default function Profile() {
  const [saved, setSaved] = useLocalStorage('hjh_profile', INITIAL_PROFILE)
  const [form, setForm] = useState(saved)
  const [saveState, setSaveState] = useState('idle') // idle | saved | error

  const update = (field, value) =>
    setForm((f) => ({ ...f, [field]: value }))

  const updatePref = (field, value) =>
    setForm((f) => ({ ...f, preferences: { ...f.preferences, [field]: value } }))

  const toggleArray = (field, value) => {
    const arr = form.preferences[field] || []
    updatePref(field, arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value])
  }

  const addSkill = () =>
    setForm((f) => ({ ...f, skills: [...f.skills, { name: '', level: 'Intermediate' }] }))

  const updateSkill = (i, key, val) =>
    setForm((f) => {
      const skills = [...f.skills]
      skills[i] = { ...skills[i], [key]: val }
      return { ...f, skills }
    })

  const removeSkill = (i) =>
    setForm((f) => ({ ...f, skills: f.skills.filter((_, idx) => idx !== i) }))

  const handleSave = () => {
    setSaved(form)
    setSaveState('saved')
    setTimeout(() => setSaveState('idle'), 2500)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Your Profile</h1>
        <p>Your details power every AI-generated application. Fill this out once — update anytime.</p>
      </div>

      {/* Personal Info */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">👤</span> Personal Info</div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>First Name</label>
            <input type="text" value={form.firstName} onChange={(e) => update('firstName', e.target.value)} placeholder="Jane" />
          </div>
          <div className="form-group">
            <label>Last Name</label>
            <input type="text" value={form.lastName} onChange={(e) => update('lastName', e.target.value)} placeholder="Smith" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="jane@example.com" />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+1 (555) 000-0000" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Location</label>
            <input type="text" value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="New York, NY" />
          </div>
          <div className="form-group">
            <label>LinkedIn URL</label>
            <input type="url" value={form.linkedIn} onChange={(e) => update('linkedIn', e.target.value)} placeholder="linkedin.com/in/jane-smith" />
          </div>
        </div>
        <div className="form-group">
          <label>Portfolio / Website</label>
          <input type="url" value={form.portfolio} onChange={(e) => update('portfolio', e.target.value)} placeholder="janesmith.com" />
        </div>
      </div>

      {/* Resume */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">📄</span> Resume</div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Paste your full resume here</label>
          <textarea
            value={form.resume}
            onChange={(e) => update('resume', e.target.value)}
            style={{ minHeight: '220px' }}
            placeholder="Paste your resume content here. Include your work experience, education, achievements, and anything you want the AI to draw from when tailoring your applications..."
          />
        </div>
      </div>

      {/* Skills */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">⚡</span> Skills & Expertise</div>
          <button className="btn btn-secondary btn-sm" onClick={addSkill}>+ Add Skill</button>
        </div>
        {form.skills.map((skill, i) => (
          <div className="skill-row" key={i}>
            <input
              type="text"
              value={skill.name}
              onChange={(e) => updateSkill(i, 'name', e.target.value)}
              placeholder={`Skill ${i + 1} (e.g. React, Python, Project Management)`}
            />
            <select value={skill.level} onChange={(e) => updateSkill(i, 'level', e.target.value)}>
              {LEVELS.map((l) => <option key={l}>{l}</option>)}
            </select>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => removeSkill(i)}
              title="Remove skill"
              style={{ flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        ))}
        {form.skills.length === 0 && (
          <p className="text-muted">No skills yet. Click "Add Skill" to start.</p>
        )}
      </div>

      {/* Job Preferences */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">🎯</span> Job Preferences</div>
        </div>
        <div className="form-group">
          <label>Desired Role(s)</label>
          <input
            type="text"
            value={form.preferences.desiredRoles}
            onChange={(e) => updatePref('desiredRoles', e.target.value)}
            placeholder="e.g. Senior Product Manager, Growth Lead, UX Designer"
          />
        </div>
        <div className="form-group">
          <label>Target Industries</label>
          <div className="check-group">
            {INDUSTRY_OPTIONS.map((ind) => (
              <CheckChip
                key={ind} label={ind}
                checked={form.preferences.industries.includes(ind)}
                onChange={() => toggleArray('industries', ind)}
              />
            ))}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Salary Min ($/yr)</label>
            <input type="number" value={form.preferences.salaryMin} onChange={(e) => updatePref('salaryMin', e.target.value)} placeholder="80000" />
          </div>
          <div className="form-group">
            <label>Salary Max ($/yr)</label>
            <input type="number" value={form.preferences.salaryMax} onChange={(e) => updatePref('salaryMax', e.target.value)} placeholder="120000" />
          </div>
        </div>
        <div className="form-group">
          <label>Work Type</label>
          <div className="check-group">
            {WORK_TYPES.map((w) => (
              <CheckChip
                key={w} label={w}
                checked={form.preferences.workTypes.includes(w)}
                onChange={() => toggleArray('workTypes', w)}
              />
            ))}
          </div>
        </div>
        <div className="form-group">
          <label>Job Type</label>
          <div className="check-group">
            {JOB_TYPES.map((j) => (
              <CheckChip
                key={j} label={j}
                checked={form.preferences.jobTypes.includes(j)}
                onChange={() => toggleArray('jobTypes', j)}
              />
            ))}
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Preferred Locations</label>
          <input
            type="text"
            value={form.preferences.locations}
            onChange={(e) => updatePref('locations', e.target.value)}
            placeholder="New York, NY; San Francisco, CA; Austin, TX"
          />
        </div>
      </div>

      {/* Tone Essay */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">✍️</span> Writing Sample</div>
        </div>
        <p className="text-muted" style={{ marginBottom: '0.875rem' }}>
          Write a few paragraphs in your natural voice. The AI will mirror your tone in every cover letter it writes for you.
        </p>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <textarea
            value={form.toneEssay}
            onChange={(e) => update('toneEssay', e.target.value)}
            style={{ minHeight: '160px' }}
            placeholder="Tell us about yourself, your career journey, what motivates you, or anything you'd like to say in your own words. The more personality, the better — don't hold back!"
          />
        </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between" style={{ marginTop: '1.5rem' }}>
        {saveState === 'saved' && (
          <div className="save-indicator">✓ Profile saved</div>
        )}
        {saveState !== 'saved' && <div />}
        <button className="btn btn-gradient btn-lg" onClick={handleSave}>
          Save Profile
        </button>
      </div>
    </div>
  )
}
