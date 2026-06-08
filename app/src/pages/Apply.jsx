import { useState, useEffect } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { generateApplicationMaterials, parseGeneratedOutput, extractJobFromUrl } from '../lib/anthropic'
import { downloadAsPdf } from '../lib/pdfExport'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const INITIAL_PROFILE = {
  firstName: '', lastName: '', email: '', phone: '',
  location: '', linkedIn: '', portfolio: '',
  resume: '', skills: [], preferences: {}, toneEssay: '',
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

export default function Apply() {
  const { user } = useAuth()
  const [profile] = useLocalStorage('hjh_profile', INITIAL_PROFILE)

  const [jobUrl, setJobUrl] = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [urlError, setUrlError] = useState('')

  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [jobDescription, setJobDescription] = useState('')

  const [extraContext, setExtraContext] = useState('')
  const [showExtra, setShowExtra] = useState(false)

  const [rawOutput, setRawOutput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState('resume')
  const [error, setError] = useState('')
  const [savedToTracker, setSavedToTracker] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('hjh_prefill_job')
    if (!raw) return
    try {
      const { title, company: co, description, url } = JSON.parse(raw)
      if (title) setJobTitle(title)
      if (co) setCompany(co)
      if (description) setJobDescription(description)
      if (url) setJobUrl(url)
    } catch {}
    localStorage.removeItem('hjh_prefill_job')
  }, [])

  const parsed = parseGeneratedOutput(rawOutput)
  const hasOutput = rawOutput.trim().length > 0

  const profileComplete = profile.firstName || profile.resume || profile.skills?.length > 0

  const handleFetchUrl = async () => {
    if (!jobUrl.trim()) return
    setUrlError('')
    setFetchingUrl(true)
    try {
      const { title, company: co, description } = await extractJobFromUrl(jobUrl)
      if (title) setJobTitle(title)
      if (co) setCompany(co)
      if (description) setJobDescription(description)
    } catch (err) {
      setUrlError(err.message || 'Could not fetch job details. Paste the description manually.')
    } finally {
      setFetchingUrl(false)
    }
  }

  const handleGenerate = async () => {
    if (!jobTitle.trim() || !company.trim() || !jobDescription.trim()) {
      setError('Please fill in job title, company name, and job description.')
      return
    }
    setError('')
    setRawOutput('')
    setSavedToTracker(false)
    setIsGenerating(true)

    let accumulated = ''
    try {
      await generateApplicationMaterials(
        profile,
        jobTitle,
        company,
        jobDescription,
        (chunk) => {
          accumulated += chunk
          setRawOutput((prev) => prev + chunk)
        },
        extraContext,
      )
      const { coverLetter } = parseGeneratedOutput(accumulated)
      if (coverLetter) localStorage.setItem('hjh_last_cover_letter', coverLetter)
    } catch (err) {
      setError(err.message || 'Something went wrong. Check your API key and try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveToTracker = async () => {
    const { error } = await supabase.from('applications').insert({
      user_id:               user.id,
      company,
      role:                  jobTitle,
      job_url:               jobUrl,
      status:                'Applied',
      date_applied:          new Date().toISOString().split('T')[0],
      notes:                 '',
      generated_resume:      parsed.resume,
      generated_cover_letter:parsed.coverLetter,
    })
    if (!error) setSavedToTracker(true)
  }

  return (
    <div className="page-wide">
      <div className="page-header">
        <h1>Generate Application</h1>
        <p>Paste a job description (or drop a URL) and get a tailored resume + cover letter written in your voice.</p>
      </div>

      {!profileComplete && (
        <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
          ⚠️ Your profile is empty. <a href="/profile" style={{ fontWeight: 600, color: 'inherit' }}>Complete your profile</a> for better results.
        </div>
      )}

      <div className="apply-layout">
        {/* Left — Job Info Form */}
        <div>
          <div className="card">
            <div className="card-header">
              <div className="card-title"><span className="card-title-icon">💼</span> Job Details</div>
            </div>

            {/* URL fetch */}
            <div className="form-group">
              <label>Paste Job URL <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional — auto-fills the fields below)</span></label>
              <div className="url-input-row">
                <input
                  type="url"
                  value={jobUrl}
                  onChange={(e) => { setJobUrl(e.target.value); setUrlError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleFetchUrl()}
                  placeholder="https://jobs.lever.co/company/job-id"
                  disabled={fetchingUrl}
                />
                <button
                  className="btn btn-secondary"
                  onClick={handleFetchUrl}
                  disabled={!jobUrl.trim() || fetchingUrl}
                >
                  {fetchingUrl ? <><span className="spinner spinner-sm spinner-primary" />Fetching…</> : 'Fetch'}
                </button>
              </div>
              {urlError && <div className="alert alert-error" style={{ marginTop: '0.5rem', marginBottom: 0 }}>{urlError}</div>}
            </div>

            <hr className="section-divider" />

            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group">
              <label>Job Title *</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Product Manager"
              />
            </div>
            <div className="form-group">
              <label>Company Name *</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Job Description *</label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                style={{ minHeight: '240px' }}
                placeholder="Paste the full job description here — responsibilities, requirements, nice-to-haves, about the company, etc."
              />
            </div>
          </div>
          {/* Extra context */}
          <div className="extra-context-section">
            <button
              type="button"
              className="extra-context-toggle"
              onClick={() => setShowExtra((v) => !v)}
            >
              <span>{showExtra ? '▾' : '▸'} Anything to add before generating?</span>
              {extraContext.trim() && <span className="extra-context-badge">✓</span>}
            </button>
            {showExtra && (
              <div className="extra-context-body">
                <textarea
                  value={extraContext}
                  onChange={(e) => setExtraContext(e.target.value)}
                  placeholder='e.g. "I also know Python but forgot to add it — beginner level" or "I have Salesforce experience from a side project"'
                  style={{ minHeight: '90px' }}
                />
                <p className="text-muted" style={{ marginTop: '0.375rem' }}>
                  Add skills, experiences, or context not in your resume. Be honest about your level — the AI will include it accurately.
                </p>
              </div>
            )}
          </div>

          <button
            className="btn btn-gradient btn-lg w-full"
            style={{ marginTop: '1rem' }}
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <><span className="spinner" />Generating…</>
            ) : (
              '✨ Generate Application Materials'
            )}
          </button>
        </div>

        {/* Right — Output */}
        <div>
          <div className="card" style={{ position: 'sticky', top: 'calc(var(--nav-height) + 1rem)' }}>
            <div className="card-header">
              <div className="card-title"><span className="card-title-icon">📋</span> Generated Materials</div>
              {hasOutput && !isGenerating && (
                <button className="btn btn-secondary btn-sm" onClick={handleSaveToTracker} disabled={savedToTracker}>
                  {savedToTracker ? '✓ Saved' : '+ Save to Tracker'}
                </button>
              )}
            </div>

            {hasOutput && (
              <div className="tabs">
                <button className={`tab-btn${activeTab === 'resume' ? ' active' : ''}`} onClick={() => setActiveTab('resume')}>
                  Resume
                </button>
                <button className={`tab-btn${activeTab === 'cover' ? ' active' : ''}`} onClick={() => setActiveTab('cover')}>
                  Cover Letter
                </button>
              </div>
            )}

            {!hasOutput && !isGenerating && (
              <div className="empty-state">
                <div className="empty-state-icon">✨</div>
                <h3>Ready to generate</h3>
                <p>Fill in the job details on the left and click Generate.</p>
              </div>
            )}

            {(hasOutput || isGenerating) && (
              <>
                {activeTab === 'resume' && (
                  <>
                    {parsed.resume && (
                      <div className="copy-row">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => downloadAsPdf(parsed.resume, 'Resume', profile, company)}
                        >
                          ⬇ PDF
                        </button>
                        <CopyButton text={parsed.resume} />
                      </div>
                    )}
                    <div className={`output-box${isGenerating && activeTab === 'resume' ? ' streaming' : ''}`}>
                      {parsed.resume || (isGenerating ? 'Generating resume…' : '')}
                    </div>
                  </>
                )}
                {activeTab === 'cover' && (
                  <>
                    {parsed.coverLetter && (
                      <div className="copy-row">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => downloadAsPdf(parsed.coverLetter, 'Cover-Letter', profile, company)}
                        >
                          ⬇ PDF
                        </button>
                        <CopyButton text={parsed.coverLetter} />
                      </div>
                    )}
                    <div className={`output-box${isGenerating && activeTab === 'cover' ? ' streaming' : ''}`}>
                      {parsed.coverLetter || (isGenerating ? 'Cover letter will appear here once resume is complete…' : '')}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
