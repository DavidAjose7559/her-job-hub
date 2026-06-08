import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { searchJobs } from '../lib/anthropic'

const INITIAL_PROFILE = {
  firstName: '', lastName: '', email: '', phone: '',
  location: '', linkedIn: '', portfolio: '',
  resume: '', skills: [], preferences: {}, toneEssay: '',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(dateStr) {
  if (!dateStr) return null
  const diff = (Date.now() - new Date(dateStr)) / (1000 * 60 * 60 * 24)
  return Math.floor(diff)
}

function recencyInfo(dateStr) {
  const d = daysSince(dateStr)
  if (d === null) return null
  if (d <= 7)  return { label: 'This week', cls: 'recency-green' }
  if (d <= 30) return { label: 'This month', cls: 'recency-amber' }
  return null // older than 30 days — filtered out
}

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

const SOURCE_MAP = [
  { key: 'LinkedIn',    pattern: 'linkedin.com',         cls: 'badge-source-linkedin'    },
  { key: 'Indeed',      pattern: 'indeed.com',            cls: 'badge-source-indeed'      },
  { key: 'Glassdoor',   pattern: 'glassdoor.com',         cls: 'badge-source-glassdoor'   },
  { key: 'Workopolis',  pattern: 'workopolis.com',        cls: 'badge-source-workopolis'  },
  { key: 'Monster',     patterns: ['monster.ca', 'monster.com'],  cls: 'badge-source-monster'    },
  { key: 'ZipRecruiter',pattern: 'ziprecruiter.com',      cls: 'badge-source-zip'         },
  { key: 'Wellfound',   patterns: ['wellfound.com', 'angel.co'],  cls: 'badge-source-wellfound'  },
  { key: 'Jobbank',     patterns: ['jobbank.gc.ca', 'guichetemplois.gc.ca'], cls: 'badge-source-jobbank' },
]

function detectSource(url) {
  if (!url) return null
  for (const entry of SOURCE_MAP) {
    const checks = entry.patterns || [entry.pattern]
    if (checks.some((p) => url.includes(p))) return entry.key
  }
  return null
}

function sourceCls(key) {
  return SOURCE_MAP.find((s) => s.key === key)?.cls || null
}

function relativeTime(date) {
  if (!date) return ''
  const s = Math.floor((Date.now() - date) / 1000)
  if (s < 10)  return 'just now'
  if (s < 60)  return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `at ${date.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SourceBadge({ source }) {
  if (!source) return null
  const cls = sourceCls(source)
  if (!cls) return null
  return <span className={`badge ${cls}`}>{source}</span>
}

function JobCard({ job, onGenerate, onSave, saved }) {
  const source  = (job.source && job.source !== 'Other') ? job.source : detectSource(job.url)
  const recency = recencyInfo(job.datePosted)

  return (
    <div className="job-card">
      <div className="job-card-header">
        <div className="job-card-main">
          <div className="job-card-title">{job.title}</div>
          <div className="job-card-company">{job.company}</div>
        </div>
        <div className="job-card-badges">
          <SourceBadge source={source} />
          {recency
            ? <span className={`badge badge-${recency.cls}`}>{recency.label}</span>
            : job.datePosted
              ? <span className="badge badge-saved">{formatDate(job.datePosted)}</span>
              : <span className="badge badge-saved" style={{ opacity: 0.5 }}>No date</span>}
          {job.fitScore != null && (
            <span className="badge badge-fit">{job.fitScore}% fit</span>
          )}
        </div>
      </div>

      <div className="job-card-meta">
        {job.location && <span className="job-meta-item">📍 {job.location}</span>}
        {job.workType && <span className="job-meta-item">💼 {job.workType}</span>}
        {job.salary   && <span className="job-meta-item">💰 {job.salary}</span>}
      </div>

      {job.whyFit && (
        <div className="job-card-fit">
          <span className="job-fit-label">Why you fit: </span>{job.whyFit}
        </div>
      )}

      <div className="job-card-actions">
        <button className="btn btn-gradient btn-sm" onClick={() => onGenerate(job)}>
          ✨ Generate Application
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => onSave(job)} disabled={saved}>
          {saved ? '✓ Saved' : '+ Save to Tracker'}
        </button>
        {job.url && (
          <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            View Posting ↗
          </a>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FindJobs() {
  const [profile] = useLocalStorage('hjh_profile', INITIAL_PROFILE)
  const [, setApplications] = useLocalStorage('hjh_applications', [])
  const navigate = useNavigate()

  const [allJobs, setAllJobs]             = useState([])
  const [expandedTitles, setExpandedTitles] = useState([])
  const [searchQueries, setSearchQueries] = useState([])
  const [loading, setLoading]             = useState(false)
  const [loadingStep, setLoadingStep]     = useState('')
  const [error, setError]                 = useState('')
  const [searched, setSearched]           = useState(false)
  const [searchTime, setSearchTime]       = useState(null)
  const [savedIds, setSavedIds]           = useState(new Set())
  const [logOpen, setLogOpen]             = useState(false)

  const [filterWorkType, setFilterWorkType] = useState('Any')
  const [filterDate,     setFilterDate]     = useState('This month')
  const [filterSource,   setFilterSource]   = useState('All')

  const profileReady = !!(
    profile.firstName ||
    profile.resume ||
    profile.skills?.length > 0 ||
    profile.preferences?.desiredRoles?.length > 0
  )

  const desiredRoles = Array.isArray(profile.preferences?.desiredRoles)
    ? profile.preferences.desiredRoles : []
  const topSkills = (profile.skills || []).filter((s) => s.name?.trim()).slice(0, 5).map((s) => s.name)

  // ── Filtering & sorting ──────────────────────────────────────────────────
  const visibleJobs = allJobs
    .filter((j) => {
      if (filterWorkType !== 'Any') {
        if (!(j.workType || '').toLowerCase().includes(filterWorkType.toLowerCase())) return false
      }
      // Undated jobs pass through all date filters — shown with gray badge
      if (j.datePosted) {
        const d = daysSince(j.datePosted)
        if (filterDate === 'This week'  && d !== null && d > 7)  return false
        if (filterDate === 'This month' && d !== null && d > 30) return false
      }
      if (filterSource !== 'All') {
        const src = j.source && j.source !== 'Other' ? j.source : detectSource(j.url)
        if (src !== filterSource) return false
      }
      return true
    })

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    setLoading(true)
    setError('')
    setAllJobs([])
    setExpandedTitles([])
    setSearchQueries([])
    setSearched(false)
    setSearchTime(null)
    setSavedIds(new Set())
    setLogOpen(false)
    try {
      const { jobs, expandedTitles: titles, queries } = await searchJobs(profile, setLoadingStep)
      setAllJobs(jobs)
      setExpandedTitles(titles)
      setSearchQueries(queries || [])
      setSearchTime(new Date())
    } catch (err) {
      setError(err.message || 'Search failed. Check your API key and try again.')
    } finally {
      setLoading(false)
      setSearched(true)
      setLoadingStep('')
    }
  }

  const handleGenerate = (job) => {
    const description = [
      `Position: ${job.title}`,
      `Company: ${job.company}`,
      job.location && `Location: ${job.location}`,
      job.workType && `Work Type: ${job.workType}`,
      job.salary   && `Salary: ${job.salary}`,
      '',
      '--- Paste or fetch the full job description below ---',
    ].filter(Boolean).join('\n')

    localStorage.setItem('hjh_prefill_job', JSON.stringify({
      title:       job.title   || '',
      company:     job.company || '',
      description,
      url:         job.url    || '',
    }))
    navigate('/apply')
  }

  const handleSave = (job) => {
    setApplications((prev) => [{
      id:                    crypto.randomUUID(),
      company:               job.company || '',
      role:                  job.title   || '',
      jobUrl:                job.url     || '',
      status:                'Saved',
      dateAdded:             new Date().toISOString(),
      dateApplied:           '',
      notes:                 job.whyFit  || '',
      generatedResume:       '',
      generatedCoverLetter:  '',
    }, ...(prev || [])])
    setSavedIds((prev) => new Set([...prev, job.url || job.title]))
  }

  // ── Loading step messages ─────────────────────────────────────────────────
  const loadingMsg = loadingStep === 'expanding'
    ? 'Expanding your target roles into related titles…'
    : 'Searching LinkedIn and Indeed for fresh postings…'

  // Unique sources present in results (preserving SOURCE_MAP order)
  const presentSources = SOURCE_MAP
    .map((s) => s.key)
    .filter((key) => allJobs.some((j) => ((j.source && j.source !== 'Other') ? j.source : detectSource(j.url)) === key))

  const sourceCount = new Set(
    allJobs.map((j) => (j.source && j.source !== 'Other') ? j.source : detectSource(j.url)).filter(Boolean)
  ).size

  return (
    <div className="page">
      <div className="page-header">
        <h1>Find Jobs</h1>
        <p>AI searches LinkedIn &amp; Indeed for fresh postings that match your profile — last 30 days only.</p>
      </div>

      {!profileReady && (
        <div className="alert alert-warning" style={{ marginBottom: '1.25rem' }}>
          ⚠️ Complete your <a href="/profile" style={{ fontWeight: 600, color: 'inherit' }}>profile</a> first — the search uses your target roles, skills, and location.
        </div>
      )}

      {/* Profile snapshot */}
      {profileReady && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>
            <div className="card-title"><span className="card-title-icon">🎯</span> Searching based on your profile</div>
          </div>
          {desiredRoles.length > 0 && (
            <div className="profile-snapshot-row">
              <span className="snapshot-label">Roles</span>
              <div className="check-group">{desiredRoles.map((r) => <span key={r} className="tag">{r}</span>)}</div>
            </div>
          )}
          {expandedTitles.length > 0 && (
            <div className="profile-snapshot-row">
              <span className="snapshot-label">Also searched</span>
              <div className="check-group">
                {expandedTitles.filter((t) => !desiredRoles.includes(t)).slice(0, 8).map((t) => (
                  <span key={t} className="tag" style={{ opacity: 0.7 }}>{t}</span>
                ))}
              </div>
            </div>
          )}
          {topSkills.length > 0 && (
            <div className="profile-snapshot-row">
              <span className="snapshot-label">Skills</span>
              <div className="check-group">{topSkills.map((s) => <span key={s} className="tag">{s}</span>)}</div>
            </div>
          )}
          {(profile.preferences?.locations || profile.location) && (
            <div className="profile-snapshot-row">
              <span className="snapshot-label">Location</span>
              <span className="text-muted">{profile.preferences?.locations || profile.location}</span>
            </div>
          )}
        </div>
      )}

      {/* Search button */}
      <button
        className="btn btn-gradient btn-lg w-full"
        style={{ marginBottom: '1.5rem' }}
        onClick={handleSearch}
        disabled={loading}
      >
        {loading
          ? <><span className="spinner" />{loadingMsg}</>
          : '🔍 Search for matching jobs'}
      </button>

      {/* Loading state */}
      {loading && (
        <div className="empty-state">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <span className="spinner spinner-primary" style={{ width: 36, height: 36, borderWidth: 3 }} />
          </div>
          <h3>{loadingMsg}</h3>
          <p style={{ marginTop: '0.375rem' }}>
            {loadingStep === 'expanding'
              ? 'Finding all related job titles from your targets…'
              : 'Running searches across LinkedIn and Indeed — 15–30 seconds.'}
          </p>
        </div>
      )}

      {/* Error */}
      {!loading && error && <div className="alert alert-error">{error}</div>}

      {/* Results header + filters */}
      {!loading && allJobs.length > 0 && (
        <>
          <div className="results-header">
            <span className="results-count">
              {visibleJobs.length} job{visibleJobs.length !== 1 ? 's' : ''} found
              {sourceCount > 0 && ` across ${sourceCount} source${sourceCount !== 1 ? 's' : ''}`}
              {allJobs.length !== visibleJobs.length && ` · ${allJobs.length} total`}
            </span>
            <span className="results-time">searched {relativeTime(searchTime)}</span>
          </div>

          <div className="filter-row">
            {['Any', 'Remote', 'Hybrid', 'On-site'].map((wt) => (
              <button key={wt} className={`filter-chip${filterWorkType === wt ? ' active' : ''}`} onClick={() => setFilterWorkType(wt)}>{wt}</button>
            ))}
            <span className="filter-divider">|</span>
            {['This week', 'This month'].map((d) => (
              <button key={d} className={`filter-chip${filterDate === d ? ' active' : ''}`} onClick={() => setFilterDate(d)}>{d}</button>
            ))}
            {presentSources.length > 0 && (
              <>
                <span className="filter-divider">|</span>
                {['All', ...presentSources].map((s) => (
                  <button key={s} className={`filter-chip${filterSource === s ? ' active' : ''}`} onClick={() => setFilterSource(s)}>{s}</button>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* Empty — no results from search */}
      {!loading && searched && !error && allJobs.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>No recent postings found</h3>
          <p>Try again later or update your target roles in your profile.</p>
        </div>
      )}

      {/* Empty — filtered out everything */}
      {!loading && allJobs.length > 0 && visibleJobs.length === 0 && (
        <div className="empty-state" style={{ padding: '2rem 1rem' }}>
          <p>No jobs match the current filters — try widening them.</p>
        </div>
      )}

      {/* Job cards */}
      {!loading && visibleJobs.length > 0 && (
        <div className="job-results">
          {visibleJobs.map((job, i) => (
            <JobCard
              key={i}
              job={job}
              onGenerate={handleGenerate}
              onSave={handleSave}
              saved={savedIds.has(job.url || job.title)}
            />
          ))}
        </div>
      )}

      {/* Search log */}
      {!loading && searched && searchQueries.length > 0 && (
        <div className="search-log-section">
          <button className="search-log-toggle" onClick={() => setLogOpen((v) => !v)}>
            {logOpen ? '▾' : '▸'} Search log — {searchQueries.length} queries run
            {allJobs.length > 0 && ` · ${allJobs.length} results returned`}
          </button>
          {logOpen && (
            <div className="search-log-body">
              <p className="text-muted" style={{ marginBottom: '0.5rem', fontSize: '0.8125rem' }}>
                These are the exact queries sent to the AI search tool:
              </p>
              <ol className="search-log-list">
                {searchQueries.map((q, i) => (
                  <li key={i}><code>{q}</code></li>
                ))}
              </ol>
              {allJobs.length === 0 && (
                <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.8125rem' }}>
                  0 results returned — the search tool may not have found accessible postings for these queries.
                  Try again or update your target roles in your profile.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
