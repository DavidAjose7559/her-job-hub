import Anthropic from '@anthropic-ai/sdk'

export function getClient() {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_key_here') {
    throw new Error('Please set VITE_ANTHROPIC_API_KEY in your .env file')
  }
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

// ── Usage logging ─────────────────────────────────────────────────────────────

function logUsage(action, usage) {
  if (!usage) return
  const cost = (
    (usage.input_tokens * 0.000003) +
    ((usage.cache_read_input_tokens || 0) * 0.0000003) +
    (usage.output_tokens * 0.000015)
  ).toFixed(5)
  console.log(
    `[Claude Usage] Action: ${action} | Input: ${usage.input_tokens} | Cache read: ${usage.cache_read_input_tokens || 0} | Cache write: ${usage.cache_creation_input_tokens || 0} | Output: ${usage.output_tokens} | Est. cost: $${cost}`,
  )
}

// ── Resume section detection ──────────────────────────────────────────────────

function detectResumeSections(resumeText) {
  const seen = new Set()
  const sections = []
  for (const line of (resumeText || '').split('\n')) {
    const t = line.trim()
    if (!t || t.length > 55 || t.length < 3) continue
    if (
      t === t.toUpperCase() &&
      /[A-Z]{2,}/.test(t) &&
      !/[•|@]/.test(t) &&
      !/^\d/.test(t) &&
      !seen.has(t)
    ) {
      seen.add(t)
      sections.push(t)
    }
  }
  return sections
}

// ── Generate resume + cover letter (streaming) ───────────────────────────────

export async function generateApplicationMaterials(profile, jobTitle, company, jobDescription, onChunk, extraContext = '') {
  const client = getClient()

  const skillsList = profile.skills
    ?.filter((s) => s.name?.trim())
    .map((s) => `• ${s.name} — ${s.level}`)
    .join('\n') || 'Not specified'

  const desiredRoles = Array.isArray(profile.preferences?.desiredRoles)
    ? profile.preferences.desiredRoles.join(', ') || 'Not specified'
    : profile.preferences?.desiredRoles || 'Not specified'

  const uploadedSections = profile.hasUploadedResume
    ? detectResumeSections(profile.resume)
    : []

  const structureInstruction = uploadedSections.length >= 2
    ? `RESUME STRUCTURE — PRESERVE EXACTLY: The candidate has an uploaded resume. Mirror its format precisely.
Section headers in EXACT order: ${uploadedSections.join(' → ')}.
Rules (all mandatory):
• Do NOT add, remove, or rename any section
• Preserve the bullet point style (• character, same indentation depth)
• Preserve date/location line format (match whatever style exists: "MMM YYYY – MMM YYYY | City" etc.)
• Preserve visual hierarchy within each role: company first, then title, then date/location
• Only content changes — structure, order, and formatting must be identical to the original`
    : `RESUME STRUCTURE: Include in order: Contact Info, Professional Summary, Work Experience, Skills, Education, Projects (if applicable).`

  // System prompt — stable profile content, cached across multiple generations
  const systemContent = `You are an expert career coach and professional resume writer helping craft job application materials.

Create a tailored resume and compelling cover letter. Write the cover letter in the candidate's own voice, using their tone/style sample as a guide.

⚠️ CRITICAL — ACCURACY & HONESTY:
Never exaggerate, inflate, or fabricate any numbers, years of experience, dates, metrics, or achievements. Only use information explicitly provided in the candidate's profile and resume. If the job description requires 5 years of experience and the candidate has 3, do NOT change it to 5 — write "3+ years" accurately. Never invent accomplishments, tools, or credentials not present in the source data. Represent the candidate honestly at all times.

═══ CANDIDATE PROFILE ═══

Name: ${(profile.firstName || '') + ' ' + (profile.lastName || '')}
Email: ${profile.email || ''}
Phone: ${profile.phone || ''}
Location: ${profile.location || ''}
LinkedIn: ${profile.linkedIn || ''}
Portfolio: ${profile.portfolio || ''}

SKILLS & EXPERTISE:
${skillsList}

JOB PREFERENCES:
Desired Roles: ${desiredRoles}
Work Type: ${profile.preferences?.workTypes?.join(', ') || 'Not specified'}
Industries: ${profile.preferences?.industries?.join(', ') || 'Not specified'}

FULL RESUME / WORK HISTORY:
${profile.resume || 'Not provided — infer from available information'}

WRITING TONE SAMPLE (match this voice and style in the cover letter):
${profile.toneEssay || 'Not provided — use a professional, warm, and confident tone'}`

  // User message — job-specific content, NOT cached
  const userContent = `${structureInstruction}

═══ TARGET ROLE ═══

Company: ${company}
Job Title: ${jobTitle}

JOB DESCRIPTION:
${jobDescription}

${extraContext.trim() ? `═══ ADDITIONAL CONTEXT FROM CANDIDATE ═══

${extraContext.trim()}
(Use this honestly — only include if it strengthens the application and reflects real experience.)

` : ''}═══ OUTPUT FORMAT (use exactly this) ═══

## TAILORED RESUME

[Write complete tailored resume content per the structure instruction above. Use bullet points for experience achievements. Highlight what is most relevant to this role.]

## COVER LETTER

[Write a 3–4 paragraph cover letter. Match the tone/voice from the writing sample. Be specific about the role and company. Open strong, show genuine fit, close confidently.]`

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: [{ type: 'text', text: systemContent, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userContent }],
  })

  stream.on('text', (text) => onChunk(text))
  const finalMsg = await stream.finalMessage()
  logUsage('Generate Application', finalMsg.usage)
}

// ── Extract skills from resume ────────────────────────────────────────────────

export async function extractSkillsFromResume(resumeText) {
  const client = getClient()
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: [{
      type: 'text',
      text: 'You are a resume parser. Extract skills accurately from the provided text and return only valid JSON.',
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{
      role: 'user',
      content: `Extract all skills from this resume. Return ONLY a JSON array where each item has "name" (skill name string) and "level" (one of exactly: "Beginner", "Intermediate", "Advanced", "Expert"). Include technical skills, tools, languages, and relevant soft skills. Be comprehensive.

Resume:
${resumeText}

Return only the JSON array, no explanation.`,
    }],
  })
  logUsage('Extract Skills', response.usage)
  const text = response.content[0].text.trim()
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Could not parse skills from resume')
  return JSON.parse(match[0])
}

// ── Fetch job from URL ────────────────────────────────────────────────────────

export async function extractJobFromUrl(url) {
  // Call our own Vercel serverless proxy — avoids CORS and runs server-side
  let html
  try {
    const proxyRes = await fetch('/api/fetch-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (!proxyRes.ok) {
      const { error } = await proxyRes.json().catch(() => ({}))
      throw new Error(error || `Proxy returned ${proxyRes.status}`)
    }
    const data = await proxyRes.json()
    html = data.html
  } catch (err) {
    throw new Error(
      err.message?.includes('block') || err.message?.includes('403') || err.message?.includes('429')
        ? "Couldn't fetch this URL — LinkedIn and Indeed block automated access. Please paste the job description manually."
        : "Couldn't fetch this URL automatically — please paste the job description manually."
    )
  }

  if (!html) throw new Error("Couldn't fetch this URL automatically — please paste the job description manually.")

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 15000)

  if (!text) throw new Error("Couldn't fetch this URL automatically — please paste the job description manually.")

  const client = getClient()
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    system: [{
      type: 'text',
      text: 'You are a job posting parser. Extract structured data from webpage text and return only valid JSON.',
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{
      role: 'user',
      content: `From this job posting webpage text, extract the job title, company name, and full job description.

Return ONLY a JSON object:
{"title": "...", "company": "...", "description": "..."}

The description should include all responsibilities, requirements, qualifications, nice-to-haves, and about-the-company sections.

Webpage text:
${text}

Return only the JSON object, nothing else.`,
    }],
  })
  logUsage('Extract Job from URL', response.usage)
  const respText = response.content[0].text.trim()
  const match = respText.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not extract job details. Try pasting the description manually.')
  return JSON.parse(match[0])
}

// ── JSON array extractor ──────────────────────────────────────────────────────

function extractJsonArray(text) {
  const start = text.indexOf('[')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '[') depth++
    else if (text[i] === ']') { depth--; if (depth === 0) return text.slice(start, i + 1) }
  }
  return null
}

// ── Expand job titles ─────────────────────────────────────────────────────────

async function expandJobTitles(targetRoles) {
  const rolesStr = Array.isArray(targetRoles)
    ? targetRoles.join(', ')
    : targetRoles || ''
  if (!rolesStr.trim()) return []

  const client = getClient()
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: [{
      type: 'text',
      text: 'You are a job market expert. Return only valid JSON arrays when asked.',
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{
      role: 'user',
      content: `Given these target job roles: ${rolesStr}

Generate a comprehensive list of ALL related job titles that companies commonly use for the same or very similar positions. Include variations in seniority, naming conventions, and industry-specific terms. Include the original titles too. Maximum 20 titles total.

Return ONLY a JSON array of strings, no explanation.`,
    }],
  })
  logUsage('Expand Job Titles', response.usage)

  try {
    const raw = extractJsonArray(response.content[0].text)
    if (!raw) return rolesStr.split(',').map((r) => r.trim()).filter(Boolean)
    return JSON.parse(raw)
  } catch {
    return rolesStr.split(',').map((r) => r.trim()).filter(Boolean)
  }
}

// ── URL validation ────────────────────────────────────────────────────────────

function isValidJobUrl(url) {
  if (!url || !url.startsWith('http')) return false
  try {
    const { pathname, search } = new URL(url)
    const pathParts = pathname.split('/').filter(Boolean)
    if (pathParts.length === 0 && !search) return false
    const genericRoots = ['jobs', 'careers', 'job-listing', 'job-listings', 'positions']
    if (pathParts.length === 1 && genericRoots.includes(pathParts[0]) && !search) return false
    const full = (pathname + search).toLowerCase()
    const tokens = [
      '/job/', '/jobs/', '/view/', '/apply/', '/detail/', '/position/',
      '/opening/', '/posting/', '/notice/', '/description/', '/listing/',
      'jk=', 'jobid=', 'job_id=', 'requisition', 'cmp=', '-job-', '/jd/',
    ]
    if (tokens.some((tok) => full.includes(tok))) return true
    if (/\/\d{4,}/.test(pathname)) return true
    if (pathParts.length >= 3) return true
    if (search.length > 5) return true
    return false
  } catch {
    return false
  }
}

function normalise(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
}

// ── Job search ────────────────────────────────────────────────────────────────

export async function searchJobs(profile, onStep) {
  const client = getClient()

  // Step 1: expand titles
  onStep?.('expanding')
  const rawRoles = Array.isArray(profile.preferences?.desiredRoles)
    ? profile.preferences.desiredRoles
    : [profile.preferences?.desiredRoles].filter(Boolean)

  const expandedTitles = await expandJobTitles(rawRoles)
  if (!expandedTitles.length) throw new Error('No target roles found. Add desired role titles in your profile first.')

  // Step 2: build search context (roles, skills, location only — not full resume)
  onStep?.('searching')

  const location  = (profile.preferences?.locations || profile.location || 'Greater Toronto Area').trim()
  const skills    = (profile.skills || []).filter((s) => s.name?.trim()).map((s) => s.name).slice(0, 12).join(', ')
  const workTypes = (profile.preferences?.workTypes || []).filter(Boolean).join(', ') || 'Any'
  const salary    = profile.preferences?.salaryMin && profile.preferences?.salaryMax
    ? `$${Number(profile.preferences.salaryMin).toLocaleString()}–$${Number(profile.preferences.salaryMax).toLocaleString()}`
    : 'Not specified'

  const titleSample = [...new Set([...rawRoles, ...expandedTitles])].slice(0, 5)
  const t = (i) => titleSample[i % titleSample.length]

  // Cap at 5 queries to limit web_search tool calls
  const searchQueries = [
    `"${t(0)}" "${location}" apply job 2026`,
    `"${t(1)}" "${location}" remote OR hybrid job 2026`,
    `site:jobbank.gc.ca "${t(0)}" ${location}`,
    `site:glassdoor.com/job-listing "${t(0)}" ${location}`,
    `"${t(2)}" (site:greenhouse.io OR site:lever.co OR site:wellfound.com) "${location}" 2026`,
  ]

  const prompt = `You are a job search assistant. Run these 5 web searches (and no more):

${searchQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

═══ RULES ═══

URL: Extract the EXACT direct URL to each specific job posting. Valid URLs contain a job ID, specific path, or query params. Do NOT include bare homepages. Omit any posting with no direct URL.

RECENCY: Prioritise 2026 postings. Accept 2025. Hard-exclude anything explicitly dated before 2025. If no date visible, set datePosted to null and STILL INCLUDE the posting.

DEDUPLICATION: Same company + very similar title = keep ONE (prefer dated + direct URL).

CANDIDATE FIT:
Target roles: ${rawRoles.join(', ')}
All title variations to accept: ${expandedTitles.join(', ')}
Skills: ${skills || 'Not specified'}
Work type preference: ${workTypes}
Salary: ${salary}
Location: ${location}

Assign fitScore 0–100 per job based on how well the candidate's skills match.

Return ONLY a valid JSON array — no markdown, no code fences:
[{
  "title": "exact job title",
  "company": "company name",
  "location": "City, Province or Remote",
  "workType": "Remote|Hybrid|On-site",
  "salary": "range or null",
  "url": "https://direct-link-to-specific-posting",
  "datePosted": "YYYY-MM-DD or null",
  "source": "LinkedIn|Indeed|Glassdoor|Workopolis|Monster|ZipRecruiter|Wellfound|Jobbank|Other",
  "whyFit": "2 sentences: why candidate skills match this role",
  "fitScore": 85
}]`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8192,
    system: [{
      type: 'text',
      text: `You are a job search assistant. Search for real job postings and return structured JSON. Target location: ${location}. Accepted roles: ${expandedTitles.slice(0, 8).join(', ')}.`,
      cache_control: { type: 'ephemeral' },
    }],
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: prompt }],
  })
  logUsage('Search Jobs', response.usage)

  const responseText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')

  const rawJson = extractJsonArray(responseText)
  if (!rawJson) throw new Error('No job listings found — try again later or update your target roles in your profile.')

  let jobs = JSON.parse(rawJson)
  if (!Array.isArray(jobs) || jobs.length === 0) {
    throw new Error('No postings found — try again later or update your target roles in your profile.')
  }

  jobs = jobs.filter((j) => isValidJobUrl(j.url))

  const floor = new Date('2025-01-01')
  jobs = jobs.filter((j) => !j.datePosted || new Date(j.datePosted) >= floor)

  const seen = new Map()
  jobs = jobs.filter((j) => {
    const key = `${normalise(j.company)}_${normalise(j.title)}`
    if (seen.has(key)) {
      const prev = seen.get(key)
      if (j.datePosted && !prev.datePosted) { seen.set(key, j); return false }
      return false
    }
    seen.set(key, j)
    return true
  })

  jobs.sort((a, b) => {
    if (a.datePosted && b.datePosted) return new Date(b.datePosted) - new Date(a.datePosted)
    if (a.datePosted && !b.datePosted) return -1
    if (!a.datePosted && b.datePosted) return 1
    return (b.fitScore || 0) - (a.fitScore || 0)
  })

  return { jobs, expandedTitles, queries: searchQueries }
}

// ── Parse generated output ────────────────────────────────────────────────────

export function parseGeneratedOutput(text) {
  const resumeMatch = text.match(/## TAILORED RESUME\s*([\s\S]*?)(?=## COVER LETTER|$)/)
  const coverMatch = text.match(/## COVER LETTER\s*([\s\S]*)$/)
  return {
    resume: resumeMatch?.[1]?.trim() || '',
    coverLetter: coverMatch?.[1]?.trim() || '',
  }
}
