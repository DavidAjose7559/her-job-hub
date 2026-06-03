import { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { generateApplicationMaterials, parseGeneratedOutput } from '../lib/anthropic'

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
  const [profile] = useLocalStorage('hjh_profile', INITIAL_PROFILE)
  const [, setApplications] = useLocalStorage('hjh_applications', [])

  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [jobDescription, setJobDescription] = useState('')

  const [rawOutput, setRawOutput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState('resume')
  const [error, setError] = useState('')
  const [savedToTracker, setSavedToTracker] = useState(false)

  const parsed = parseGeneratedOutput(rawOutput)
  const hasOutput = rawOutput.trim().length > 0

  const profileComplete = profile.firstName || profile.resume || profile.skills?.length > 0

  const handleGenerate = async () => {
    if (!jobTitle.trim() || !company.trim() || !jobDescription.trim()) {
      setError('Please fill in job title, company name, and job description.')
      return
    }
    setError('')
    setRawOutput('')
    setSavedToTracker(false)
    setIsGenerating(true)

    try {
      await generateApplicationMaterials(
        profile,
        jobTitle,
        company,
        jobDescription,
        (chunk) => setRawOutput((prev) => prev + chunk),
      )
    } catch (err) {
      setError(err.message || 'Something went wrong. Check your API key and try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveToTracker = () => {
    const newApp = {
      id: crypto.randomUUID(),
      company,
      role: jobTitle,
      jobUrl: '',
      status: 'Applied',
      dateAdded: new Date().toISOString(),
      dateApplied: new Date().toISOString().split('T')[0],
      notes: '',
      generatedResume: parsed.resume,
      generatedCoverLetter: parsed.coverLetter,
    }
    setApplications((prev) => [newApp, ...(prev || [])])
    setSavedToTracker(true)
  }

  return (
    <div className="page-wide">
      <div className="page-header">
        <h1>Generate Application</h1>
        <p>Paste a job description and get a tailored resume + cover letter written in your voice.</p>
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
                style={{ minHeight: '280px' }}
                placeholder="Paste the full job description here — responsibilities, requirements, nice-to-haves, about the company, etc."
              />
            </div>
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
