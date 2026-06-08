import jsPDF from 'jspdf'

// Letter dimensions in mm
const PW = 215.9
const PH = 279.4
const M  = 19.05  // 0.75 in margins

// Line heights (mm) at 1.3 leading
const LH_NAME    = 9.5
const LH_CONTACT = 5.0
const LH_SECTION = 6.2
const LH_JOB     = 5.8
const LH_BODY    = 5.2
const LH_GAP     = 3.0

function mkCtx() {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  let y = M

  const np = () => { doc.addPage(); y = M }
  // 12mm bottom reserve: 8mm for page# + 4mm safe zone
  const ck = (h) => { if (y + h > PH - M - 12) np() }
  const cw = () => PW - M * 2

  return { doc, np, ck, cw, getY: () => y, setY: (v) => { y = v }, addY: (d) => { y += d } }
}

function addPageNumbers(doc) {
  const total = doc.internal.getNumberOfPages()
  if (total < 2) return
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`${i} / ${total}`, PW / 2, PH - 8, { align: 'center' })
  }
}

// ─── Resume renderer ───────────────────────────────────────────────────────

function renderResume(ctx, lines) {
  const { doc, ck, cw, getY, setY, addY } = ctx
  let headerDone = false
  let firstLine = true

  for (const raw of lines) {
    const line = raw.trimEnd()
    const t = line.trim()
    if (!t) { addY(firstLine ? 0 : LH_GAP); continue }

    const y = getY()
    const CW = cw()

    // ── Name line ──────────────────────────────────────────────────────────
    if (firstLine) {
      firstLine = false
      ck(LH_NAME + 2)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.setTextColor(0, 0, 0)
      doc.text(t, PW / 2, getY(), { align: 'center' })
      addY(LH_NAME)
      continue
    }

    // ── Contact line (contains @ or label prefixes, before first section) ──
    if (!headerDone && (t.includes('@') || /Mobile:|Phone:|Email:|LinkedIn:/i.test(t))) {
      ck(LH_CONTACT + 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(60, 60, 60)
      doc.text(t, PW / 2, getY(), { align: 'center' })
      addY(LH_CONTACT)
      continue
    }

    // ── Section header: ALL CAPS, no bullets/pipes/@ ───────────────────────
    const isSection = t === t.toUpperCase()
      && /[A-Z]{2,}/.test(t)
      && t.length >= 3 && t.length <= 55
      && !/[•|@]/.test(t)
      && !/^\d/.test(t)

    if (isSection) {
      headerDone = true
      addY(LH_GAP * 1.5)
      ck(LH_SECTION + 4)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(0, 0, 0)
      doc.text(t, M, getY())
      addY(LH_SECTION * 0.4)
      doc.setDrawColor(30, 30, 30)
      doc.setLineWidth(0.35)
      doc.line(M, getY(), M + CW, getY())
      addY(LH_SECTION * 0.9)
      continue
    }

    // ── Job entry: pipe-separated, no email ───────────────────────────────
    if (t.includes('|') && !t.includes('@')) {
      ck(LH_JOB)
      const sepIdx = t.indexOf(' | ')
      if (sepIdx > -1) {
        const first = t.slice(0, sepIdx)
        const rest  = t.slice(sepIdx)           // includes " | "
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10.5)
        doc.setTextColor(0, 0, 0)
        doc.text(first, M, getY())
        const fw = doc.getTextWidth(first)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(60, 60, 60)
        // Clip rest to remaining width
        const restW = CW - fw
        const clipped = doc.splitTextToSize(rest, restW)[0]
        doc.text(clipped, M + fw, getY())
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(0, 0, 0)
        doc.text(doc.splitTextToSize(t, CW)[0], M, getY())
      }
      addY(LH_JOB)
      continue
    }

    // ── Bullet ─────────────────────────────────────────────────────────────
    if (t.startsWith('•')) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(0, 0, 0)
      const indent = 5
      const wrapped = doc.splitTextToSize(t, CW - indent)
      for (const wl of wrapped) {
        ck(LH_BODY)
        doc.text(wl, M + indent, getY())
        addY(LH_BODY)
      }
      continue
    }

    // ── Body / paragraph ──────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    const wrapped = doc.splitTextToSize(t, CW)
    for (const wl of wrapped) {
      ck(LH_BODY)
      doc.text(wl, M, getY())
      addY(LH_BODY)
    }
  }
}

// ─── Cover letter renderer ─────────────────────────────────────────────────

function renderCoverLetter(ctx, lines, profile) {
  const { doc, ck, cw, getY, setY, addY } = ctx
  const CW = cw()

  // Letterhead (right-aligned)
  const name    = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')
  const contact = [profile?.email, profile?.phone, profile?.location].filter(Boolean).join('  |  ')
  const today   = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })

  if (name) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)
    doc.text(name, M + CW, getY(), { align: 'right' })
    addY(5.5)
  }
  if (contact) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text(contact, M + CW, getY(), { align: 'right' })
    addY(5)
  }
  addY(LH_GAP)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text(today, M, getY())
  addY(LH_BODY * 2)

  // Body
  for (const raw of lines) {
    const line = raw.trimEnd()
    const t = line.trim()
    if (!t) { addY(LH_GAP * 1.5); continue }

    ck(LH_BODY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    doc.setTextColor(0, 0, 0)
    const wrapped = doc.splitTextToSize(t, CW)
    for (const wl of wrapped) {
      ck(LH_BODY)
      doc.text(wl, M, getY())
      addY(LH_BODY * 1.3)
    }
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export function downloadAsPdf(text, docType, profile, company) {
  const ctx = mkCtx()
  const isResume = docType === 'Resume'

  const lines = text.split('\n')

  if (isResume) {
    renderResume(ctx, lines)
  } else {
    renderCoverLetter(ctx, lines, profile)
  }

  addPageNumbers(ctx.doc)

  const safePerson = ([profile?.firstName, profile?.lastName].filter(Boolean).join('-') || 'Download')
    .replace(/[^a-zA-Z0-9-]/g, '')
  const safeCompany = (company || '').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
  const filename = safeCompany
    ? `${safePerson}-${docType}-${safeCompany}.pdf`
    : `${safePerson}-${docType}.pdf`

  ctx.doc.save(filename)
}
