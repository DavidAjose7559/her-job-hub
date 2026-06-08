import { useState, useRef, useEffect } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { extractTextFromFile } from '../lib/fileExtract'
import { extractSkillsFromResume } from '../lib/anthropic'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const INITIAL_PROFILE = {
  firstName: '', lastName: '', email: '', phone: '',
  location: '', linkedIn: '', portfolio: '',
  resume: '',
  hasUploadedResume: false,
  skills: [{ name: '', level: 'Intermediate' }],
  preferences: {
    desiredRoles: [],
    industries: [],
    salaryMin: '', salaryMax: '',
    workTypes: [],
    jobTypes: [],
    locations: '',
  },
  toneEssay: '',
}

const TEST_DATA = {
  firstName: 'David',
  lastName: 'Ajose',
  email: 'davidajose30@gmail.com',
  phone: '+1 647-574-0866',
  location: 'Greater Toronto Area',
  linkedIn: 'https://www.linkedin.com/in/david-ajose-6566271aa/',
  hasUploadedResume: true,
  portfolio: '',
  resume: `David Ajose
Email: davidajose30@gmail.com | Mobile: (+1) 647-574-0866 | LinkedIn: David Ajose

PROFESSIONAL SUMMARY
Application & Technical Support Specialist with 3+ years of experience supporting SaaS platforms, APIs, and connected products in fast-paced environments. Proven ability to troubleshoot complex technical issues, analyze system logs, and resolve customer incidents while maintaining high CSAT and SLA performance. Experienced with Zendesk, ServiceNow, Postman, REST APIs, SQL, JSON, and JavaScript, with a strong focus on root cause analysis, automation, and improving support workflows.

WORK EXPERIENCE

Aftership | Application Engineer | MAR 2026 – PRESENT | Toronto, ON
• Delivered real-time customer support via chat and ticketing systems, resolving issues for SMB to enterprise clients across platforms like Shopify, Amazon, Etsy, and Groupon.

Aviron Interactive | Technical Analyst | OCT 2024 – MAR 2026 | Toronto, ON
• Resolved 50+ weekly SaaS, hardware, and network issues using Zendesk, RingCentral, and Mirror.me, maintaining 98%+ CSAT and consistent SLA compliance.
• Reduced average ticket resolution time by 25% by implementing Mirror.me live troubleshooting workflows.
• Developed and deployed a UPS Shipping Quote API using Google Apps Script, Node.js, REST APIs, and Express, saving ~10 hours weekly.
• Built an automated Competitor-Intelligence News Digest using Apps Script and OpenAI API, saving 2+ hours weekly.
• Collaborated cross-functionally with Product, Engineering, and CX teams to surface insights and report bugs.
• Authored and maintained technical documentation and knowledge base articles.
• Participated in QA testing of new product features and firmware releases.

Humber College ITAL | Technical Support Specialist | SEPT 2021 – SEPT 2022 | Toronto, ON
• Resolved 50+ weekly technical issues across Windows, Linux, and network systems with 95% resolution rate using ServiceNow.
• Managed user accounts and permissions through Active Directory and Office 365.
• Trained and mentored new technicians, standardizing support procedures.

Walmart | Store Standards Associate | MAY 2020 – 2021 | Mississauga, ON

Print Production Nigeria LTD | Technical Support Specialist | MAY 2018 – AUG 2019 | Lagos, Nigeria
• Provided front-line technical support for printers, computers, and mobile devices.
• Diagnosed and resolved 95% of technical issues independently.

EDUCATION
Humber College | Advanced Diploma, Computer Engineering Technology | May 2024 | Toronto, ON

PROJECTS
Daily-Verse | Full-Stack Web App (2025) — Node.js, JavaScript, HTML, CSS, Express
UPS Shipping Quote API | Aviron (2025) — Google Apps Script, REST API, Node.js, Postman
Competitor-Intelligence News Digest | Aviron (2025) — Google Apps Script, OpenAI API
myDisposal App | Android (2024) — Java, XML, Android Studio, Firebase

SKILLS
Technical Troubleshooting, SaaS Platforms, REST APIs, Zendesk, ServiceNow, Postman, SQL, JavaScript, Node.js, Google Apps Script, OpenAI API, Freshdesk, HubSpot, Active Directory, Firebase, Root Cause Analysis, Knowledge Base Development`,
  skills: [
    { name: 'Technical Troubleshooting', level: 'Advanced' },
    { name: 'SaaS Platforms', level: 'Advanced' },
    { name: 'Zendesk', level: 'Advanced' },
    { name: 'ServiceNow', level: 'Advanced' },
    { name: 'Root Cause Analysis', level: 'Advanced' },
    { name: 'REST APIs', level: 'Intermediate' },
    { name: 'Postman', level: 'Intermediate' },
    { name: 'JavaScript', level: 'Intermediate' },
    { name: 'Node.js', level: 'Intermediate' },
    { name: 'Google Apps Script', level: 'Intermediate' },
    { name: 'SQL', level: 'Intermediate' },
    { name: 'OpenAI API', level: 'Intermediate' },
    { name: 'Freshdesk', level: 'Intermediate' },
    { name: 'HubSpot', level: 'Intermediate' },
    { name: 'Active Directory', level: 'Intermediate' },
    { name: 'Knowledge Base Development', level: 'Intermediate' },
    { name: 'Firebase', level: 'Beginner' },
  ],
  preferences: {
    desiredRoles: ['Technical Support Specialist', 'Application Support Engineer', 'IT Support Analyst', 'Application Engineer', 'Technical Analyst'],
    industries: ['No specific industry / Open to all'],
    salaryMin: '70000',
    salaryMax: '90000',
    workTypes: ['Any'],
    jobTypes: ['Full-time'],
    locations: 'Greater Toronto Area (GTA)',
  },
  toneEssay: `Application & Technical Support Specialist with 3+ years of experience supporting SaaS platforms, APIs, and connected products. Based in the Greater Toronto Area. Passionate about root cause analysis, automation, and improving support workflows. Has built real production tools including a UPS Shipping Quote API and an AI-powered competitor intelligence digest. Collaborative, detail-oriented, thrives working cross-functionally with Product and Engineering teams.

My writing style is professional but direct — confident without being boastful, results-focused with specific numbers and impact. Slightly conversational but always polished.`,
}

const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert']

const INDUSTRY_OPTIONS = [
  'No specific industry / Open to all',
  'Technology', 'Finance', 'Healthcare', 'Marketing', 'Design',
  'Education', 'Consulting', 'Media', 'Retail', 'Non-profit', 'Legal', 'Real Estate',
]

const WORK_TYPES = ['Any', 'Remote', 'Hybrid', 'On-site']
const JOB_TYPES  = ['Full-time', 'Part-time', 'Contract', 'Freelance']

const OPEN_ALL_INDUSTRY = 'No specific industry / Open to all'

const LOCATION_SUGGESTIONS = [
  'Greater Toronto Area (GTA)',
  'Toronto, ON',
  'Mississauga, ON',
  'Brampton, ON',
  'Markham, ON',
  'Vaughan, ON',
  'Scarborough, ON',
  'Vancouver, BC',
  'Calgary, AB',
  'Ottawa, ON',
  'Montreal, QC',
  'New York, NY',
  'San Francisco, CA',
  'Remote',
]

function CheckChip({ label, checked, onChange }) {
  return (
    <label className={`check-chip${checked ? ' checked' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  )
}

function TagInput({ tags, onAdd, onRemove, placeholder }) {
  const [input, setInput] = useState('')

  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault()
      const tag = input.trim().replace(/,+$/, '')
      if (tag && !tags.includes(tag)) onAdd(tag)
      setInput('')
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      onRemove(tags.length - 1)
    }
  }

  return (
    <div className="tag-input-wrapper">
      {tags.map((tag, i) => (
        <span key={i} className="tag">
          {tag}
          <button className="tag-remove" onClick={() => onRemove(i)} type="button">✕</button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : 'Add another…'}
        className="tag-input-field"
      />
    </div>
  )
}

function FileUploadBtn({ onExtract, loading, label = 'Upload File' }) {
  const inputRef = useRef(null)

  const handleChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    await onExtract(file)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
      >
        {loading ? <><span className="spinner spinner-sm" />Extracting…</> : `📎 ${label}`}
      </button>
    </>
  )
}

function normalizeDesiredRoles(val) {
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val.trim()) return [val.trim()]
  return []
}

export default function Profile() {
  const { user } = useAuth()
  // localStorage kept as read cache so Apply/FindJobs can read the profile without a DB call
  const [, setSaved] = useLocalStorage('hjh_profile', INITIAL_PROFILE)
  const [form, setForm] = useState(INITIAL_PROFILE)
  const [profileLoading, setProfileLoading] = useState(true)
  const [saveState, setSaveState] = useState('idle')

  useEffect(() => {
    if (!user) { setProfileLoading(false); return }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const nameParts = (data.name || '').split(' ')
          const salary    = (data.salary || '').split('-')
          const merged = {
            ...INITIAL_PROFILE,
            firstName:        nameParts[0] || '',
            lastName:         nameParts.slice(1).join(' ') || '',
            email:            data.email     || '',
            phone:            data.phone     || '',
            location:         data.location  || '',
            linkedIn:         data.linkedin  || '',
            portfolio:        data.portfolio || '',
            resume:           data.resume_text || '',
            hasUploadedResume:!!(data.resume_text),
            skills:           Array.isArray(data.skills) ? data.skills : [],
            toneEssay:        data.tone_sample || '',
            preferences: {
              ...INITIAL_PROFILE.preferences,
              desiredRoles: normalizeDesiredRoles(
                Array.isArray(data.target_roles) ? data.target_roles : []
              ),
              industries: Array.isArray(data.industries)
                ? data.industries
                : (data.industries || '').split(',').map((s) => s.trim()).filter(Boolean),
              workTypes: Array.isArray(data.work_type)
                ? data.work_type
                : (data.work_type || '').split(',').map((s) => s.trim()).filter(Boolean),
              salaryMin: salary[0]?.trim() || '',
              salaryMax: salary[1]?.trim() || '',
            },
          }
          setForm(merged)
          setSaved(merged)
        }
        setProfileLoading(false)
      })
  }, [user])
  const [resumeFileLoading, setResumeFileLoading] = useState(false)
  const [toneFileLoading, setToneFileLoading] = useState(false)
  const [extractingSkills, setExtractingSkills] = useState(false)
  const [skillsError, setSkillsError] = useState('')

  const update = (field, value) =>
    setForm((f) => ({ ...f, [field]: value }))

  const updatePref = (field, value) =>
    setForm((f) => ({ ...f, preferences: { ...f.preferences, [field]: value } }))

  const toggleWorkType = (value) => {
    if (value === 'Any') {
      updatePref('workTypes', ['Any'])
    } else {
      const arr = (form.preferences.workTypes || []).filter((v) => v !== 'Any')
      updatePref('workTypes', arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value])
    }
  }

  const toggleIndustry = (value) => {
    if (value === OPEN_ALL_INDUSTRY) {
      updatePref('industries', [OPEN_ALL_INDUSTRY])
    } else {
      const arr = (form.preferences.industries || []).filter((v) => v !== OPEN_ALL_INDUSTRY)
      updatePref('industries', arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value])
    }
  }

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

  const handleResumeFile = async (file) => {
    setResumeFileLoading(true)
    try {
      const text = await extractTextFromFile(file)
      setForm((f) => ({ ...f, resume: text, hasUploadedResume: true }))
    } catch (err) {
      alert(err.message)
    } finally {
      setResumeFileLoading(false)
    }
  }

  const handleToneFile = async (file) => {
    setToneFileLoading(true)
    try {
      const text = await extractTextFromFile(file)
      update('toneEssay', text)
    } catch (err) {
      alert(err.message)
    } finally {
      setToneFileLoading(false)
    }
  }

  const handleExtractSkills = async () => {
    if (!form.resume.trim()) {
      setSkillsError('Add your resume text first so the AI has something to extract from.')
      return
    }
    setSkillsError('')
    setExtractingSkills(true)
    try {
      const extracted = await extractSkillsFromResume(form.resume)
      if (!extracted.length) {
        setSkillsError('No skills found. Make sure your resume has skill-related content.')
        return
      }
      setForm((f) => ({ ...f, skills: extracted }))
    } catch (err) {
      setSkillsError(err.message || 'Failed to extract skills.')
    } finally {
      setExtractingSkills(false)
    }
  }

  const addDesiredRole = (role) =>
    updatePref('desiredRoles', [...(form.preferences.desiredRoles || []), role])

  const removeDesiredRole = (i) =>
    updatePref('desiredRoles', form.preferences.desiredRoles.filter((_, idx) => idx !== i))

  const handleFillTestData = () => setForm(TEST_DATA)

  const handleSave = async () => {
    setSaveState('saving')
    const pref = form.preferences || {}
    const { error } = await supabase.from('profiles').upsert({
      id:           user.id,
      name:         [form.firstName, form.lastName].filter(Boolean).join(' '),
      email:        form.email      || '',
      phone:        form.phone      || '',
      location:     form.location   || '',
      linkedin:     form.linkedIn   || '',
      portfolio:    form.portfolio  || '',
      resume_text:  form.resume     || '',
      skills:       form.skills     || [],
      expertise:    (form.skills || [])
                      .filter((s) => s.name?.trim())
                      .map((s) => `${s.level} in ${s.name}`)
                      .join(', '),
      target_roles: Array.isArray(pref.desiredRoles) ? pref.desiredRoles : [],
      industries:   (pref.industries || []).join(', '),
      work_type:    (pref.workTypes  || []).join(', '),
      salary:       pref.salaryMin && pref.salaryMax
                      ? `${pref.salaryMin}-${pref.salaryMax}`
                      : (pref.salaryMin || pref.salaryMax || ''),
      about:        '',
      tone_sample:  form.toneEssay  || '',
      updated_at:   new Date().toISOString(),
    })
    if (error) {
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 3000)
    } else {
      setSaved(form) // keep localStorage cache in sync
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    }
  }

  if (profileLoading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
        <span className="spinner spinner-primary" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1>Your Profile</h1>
          <p>Your details power every AI-generated application. Fill this out once — update anytime.</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ flexShrink: 0, marginTop: '0.25rem' }}
          onClick={handleFillTestData}
        >
          Fill with test data
        </button>
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
            <input
              type="text"
              list="location-suggestions"
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder="e.g. Greater Toronto Area (GTA)"
            />
            <datalist id="location-suggestions">
              {LOCATION_SUGGESTIONS.map((l) => <option key={l} value={l} />)}
            </datalist>
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
          <FileUploadBtn onExtract={handleResumeFile} loading={resumeFileLoading} label="Upload Resume" />
        </div>
        <p className="text-muted" style={{ marginBottom: '0.625rem' }}>
          Upload a file (.pdf, .docx, .txt) or paste your resume text below.
        </p>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <textarea
            value={form.resume}
            onChange={(e) => update('resume', e.target.value)}
            style={{ minHeight: '220px' }}
            placeholder="Paste your resume content here — work experience, education, achievements, and anything you want the AI to draw from..."
          />
        </div>
      </div>

      {/* Skills */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">⚡</span> Skills & Expertise</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExtractSkills}
              disabled={extractingSkills}
            >
              {extractingSkills ? <><span className="spinner spinner-sm" />Extracting…</> : '✨ Extract from Resume'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={addSkill}>+ Add Skill</button>
          </div>
        </div>
        {skillsError && <div className="alert alert-warning" style={{ marginBottom: '0.75rem' }}>{skillsError}</div>}
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
          <p className="text-muted">No skills yet. Click "Add Skill" or use "Extract from Resume" to auto-populate.</p>
        )}
      </div>

      {/* Job Preferences */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">🎯</span> Job Preferences</div>
        </div>

        <div className="form-group">
          <label>Desired Role Titles</label>
          <TagInput
            tags={form.preferences.desiredRoles}
            onAdd={addDesiredRole}
            onRemove={removeDesiredRole}
            placeholder="Type a role title and press Enter — e.g. Product Manager"
          />
          <p className="text-muted" style={{ marginTop: '0.375rem' }}>
            Add example titles you're targeting. The AI uses these to understand the types of roles you want — not exact match filters.
          </p>
        </div>

        <div className="form-group">
          <label>Target Industries</label>
          <div className="check-group">
            {INDUSTRY_OPTIONS.map((ind) => (
              <CheckChip
                key={ind} label={ind}
                checked={form.preferences.industries.includes(ind)}
                onChange={() => toggleIndustry(ind)}
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
                onChange={() => toggleWorkType(w)}
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
            list="pref-location-suggestions"
            value={form.preferences.locations}
            onChange={(e) => updatePref('locations', e.target.value)}
            placeholder="Greater Toronto Area (GTA); Vancouver, BC; Remote"
          />
          <datalist id="pref-location-suggestions">
            {LOCATION_SUGGESTIONS.map((l) => <option key={l} value={l} />)}
          </datalist>
        </div>
      </div>

      {/* Tone Essay */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">✍️</span> Writing Sample</div>
          <FileUploadBtn onExtract={handleToneFile} loading={toneFileLoading} label="Upload Sample" />
        </div>
        <p className="text-muted" style={{ marginBottom: '0.875rem' }}>
          Upload a file (.pdf, .docx, .txt) or write a few paragraphs in your natural voice. The AI mirrors your tone in every cover letter.
        </p>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <textarea
            value={form.toneEssay}
            onChange={(e) => update('toneEssay', e.target.value)}
            style={{ minHeight: '160px' }}
            placeholder="Tell us about yourself, your career journey, what motivates you, or anything in your own words. The more personality the better — don't hold back!"
          />
        </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between" style={{ marginTop: '1.5rem' }}>
        {saveState === 'saved'  && <div className="save-indicator">✓ Profile saved</div>}
        {saveState === 'error'  && <div className="alert alert-error" style={{ padding: '0.375rem 0.75rem' }}>Save failed — try again</div>}
        {saveState === 'saving' && <div className="save-indicator"><span className="spinner spinner-primary spinner-sm" /> Saving…</div>}
        {!['saved','error','saving'].includes(saveState) && <div />}
        <button className="btn btn-gradient btn-lg" onClick={handleSave} disabled={saveState === 'saving' || profileLoading}>
          Save Profile
        </button>
      </div>
    </div>
  )
}
