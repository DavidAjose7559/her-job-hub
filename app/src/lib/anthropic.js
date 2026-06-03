import Anthropic from '@anthropic-ai/sdk'

export function getClient() {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_key_here') {
    throw new Error('Please set VITE_ANTHROPIC_API_KEY in your .env file')
  }
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

export async function generateApplicationMaterials(profile, jobTitle, company, jobDescription, onChunk) {
  const client = getClient()

  const skillsList = profile.skills
    ?.filter((s) => s.name?.trim())
    .map((s) => `• ${s.name} — ${s.level}`)
    .join('\n') || 'Not specified'

  const prompt = `You are an expert career coach and professional resume writer helping craft job application materials.

Create a tailored resume and compelling cover letter. Write the cover letter in the candidate's own voice, using their tone/style sample as a guide.

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
Desired Roles: ${profile.preferences?.desiredRoles || 'Not specified'}
Work Type: ${profile.preferences?.workTypes?.join(', ') || 'Not specified'}
Industries: ${profile.preferences?.industries?.join(', ') || 'Not specified'}

FULL RESUME / WORK HISTORY:
${profile.resume || 'Not provided — infer from available information'}

WRITING TONE SAMPLE (match this voice and style in the cover letter):
${profile.toneEssay || 'Not provided — use a professional, warm, and confident tone'}

═══ TARGET ROLE ═══

Company: ${company}
Job Title: ${jobTitle}

JOB DESCRIPTION:
${jobDescription}

═══ OUTPUT FORMAT (use exactly this) ═══

## TAILORED RESUME

[Write a complete tailored resume. Include: Contact Info, Professional Summary, Experience (with bullet-point achievements), Skills, Education. Highlight experience most relevant to this specific role.]

## COVER LETTER

[Write a 3–4 paragraph cover letter. Match the tone/voice from the writing sample. Be specific about the role and company. Open strong, show genuine fit, close confidently.]`

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  stream.on('text', (text) => onChunk(text))
  await stream.done()
}

export function parseGeneratedOutput(text) {
  const resumeMatch = text.match(/## TAILORED RESUME\s*([\s\S]*?)(?=## COVER LETTER|$)/)
  const coverMatch = text.match(/## COVER LETTER\s*([\s\S]*)$/)
  return {
    resume: resumeMatch?.[1]?.trim() || '',
    coverLetter: coverMatch?.[1]?.trim() || '',
  }
}
