import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { toast } from 'sonner'
import { ArrowLeft, Save, Send, Copy, Pause, Play, Ban, ChevronRight, ChevronLeft, BarChart2, Download } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'

interface Campaign {
  id: string; name: string; subject: string; preview_text: string | null;
  from_name: string; from_email: string; reply_to: string | null;
  template_id: string | null; html: string | null; status: string;
  scheduled_at: string | null; sent_at: string | null;
  total_recipients: number; total_sent: number; total_delivered: number;
  total_opened: number; total_clicked: number; total_bounced: number;
  total_complained: number; total_unsubscribed: number;
}

type Step = 'details' | 'audience' | 'design' | 'review'
const STEPS: { key: Step; label: string }[] = [
  { key: 'details', label: '1. Details' },
  { key: 'audience', label: '2. Audience' },
  { key: 'design', label: '3. Design' },
  { key: 'review', label: '4. Review & Send' },
]

function fmt(n: number) { return n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n||0) }
function pct(a: number, b: number) { return b ? `${((a/b)*100).toFixed(1)}%` : '0.0%' }

export default function CampaignEditor() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { canEdit } = useAuth()
  const [c, setC] = useState<Campaign | null>(null)
  const [templates, setTemplates] = useState<{ id: string; name: string; subject: string | null; html: string | null }[]>([])
  const [lists, setLists] = useState<{ id: string; name: string }[]>([])
  const [selectedLists, setSelectedLists] = useState<string[]>([])
  const [scheduleAt, setScheduleAt] = useState('')
  const [step, setStep] = useState<Step>('details')
  const [testEmails, setTestEmails] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'wizard' | 'report'>('wizard')
  const [reportEvents, setReportEvents] = useState<{ day: string; opens: number; clicks: number }[]>([])

  const load = useCallback(async () => {
    const { data } = await supabase.from('campaigns').select('*').eq('id', id!).single()
    if (data) setC(data as Campaign)
    const { data: cl } = await supabase.from('campaign_lists').select('list_id').eq('campaign_id', id!)
    setSelectedLists((cl ?? []).map((x: { list_id: string }) => x.list_id))
  }, [id])

  useEffect(() => {
    load()
    supabase.from('templates').select('id,name,subject,html').then(({ data }) => setTemplates(data ?? []))
    supabase.from('contact_lists').select('id,name').then(({ data }) => setLists(data ?? []))
  }, [id, load])

  useEffect(() => {
    if (!selectedLists.length) { setRecipientCount(0); return }
    ;(async () => {
      const { count } = await supabase.from('list_memberships').select('*', { count: 'exact', head: true }).in('list_id', selectedLists)
      setRecipientCount(count ?? 0)
    })()
  }, [selectedLists])

  const loadReport = async () => {
    const { data: events } = await supabase.from('email_events').select('event_type,occurred_at').eq('campaign_id', id!).in('event_type', ['opened', 'clicked'])
    if (!events) return
    const dayMap: Record<string, { opens: number; clicks: number }> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
      dayMap[d] = { opens: 0, clicks: 0 }
    }
    events.forEach((e: { event_type: string; occurred_at: string }) => {
      const d = new Date(e.occurred_at).toISOString().slice(0, 10)
      if (!dayMap[d]) return
      if (e.event_type === 'opened') dayMap[d].opens++
      if (e.event_type === 'clicked') dayMap[d].clicks++
    })
    setReportEvents(Object.entries(dayMap).map(([day, v]) => ({ day: day.slice(5), ...v })))
  }

  if (!c) return <div style={{ padding: 32, color: 'var(--text2)' }}>Loading...</div>

  const update = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from('campaigns').update(patch as never).eq('id', id!)
    if (error) toast.error(error.message)
    else load()
  }

  const saveLists = async (include: string[]) => {
    setSelectedLists(include)
    await supabase.from('campaign_lists').delete().eq('campaign_id', id!)
    if (include.length) await supabase.from('campaign_lists').insert(include.map(list_id => ({ campaign_id: id!, list_id })))
  }

  const applyTemplate = async (tid: string) => {
    const t = templates.find(x => x.id === tid)
    if (!t) return
    await update({ template_id: tid, html: t.html, subject: t.subject || c.subject })
    toast.success('Template applied')
  }

  const sendTest = async () => {
    const addrs = testEmails.split(',').map(e => e.trim()).filter(Boolean)
    if (!addrs.length || addrs.length > 5) { toast.error('Enter 1–5 email addresses'); return }
    if (!c.html) { toast.error('No email content yet'); return }
    setTestSending(true)
    try {
      const res = await fetch('/api/public/campaigns/test-send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: id, addresses: addrs }),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed')
      else toast.success(`Test sent to ${addrs.length} address${addrs.length > 1 ? 'es' : ''}`)
    } catch { toast.info('Test send requires AWS SES to be configured') }
    setTestSending(false)
  }

  const sendNow = async () => {
    if (!confirm(`Send to ~${recipientCount ?? '?'} recipients now?`)) return
    try {
      const res = await fetch('/api/public/campaigns/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: id, schedule_at: null }),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed')
      else { toast.success(`Queued ${data.queued} recipients`); load(); setActiveTab('report') }
    } catch { toast.error('Sending requires AWS SES to be configured') }
  }

  const schedule = async () => {
    if (!scheduleAt) { toast.error('Pick a date/time'); return }
    try {
      const res = await fetch('/api/public/campaigns/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: id, schedule_at: new Date(scheduleAt).toISOString() }),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed')
      else { toast.success('Scheduled'); load() }
    } catch { toast.error('Scheduling requires the backend API') }
  }

  const isLocked = ['sending', 'sent'].includes(c.status)
  const stepIdx = STEPS.findIndex(s => s.key === step)
  const hasReport = ['sending', 'sent', 'paused'].includes(c.status)

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <button className="btn-ghost" onClick={() => nav('/campaigns')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={16} /> All campaigns
        </button>
      </div>

      <div className="page-header">
        <div>
          <div className="page-title">{c.name}</div>
          <div style={{ marginTop: 8 }}><span className={`badge badge-${c.status}`}>{c.status}</span>{c.sent_at && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text2)' }}>Sent {new Date(c.sent_at).toLocaleString()}</span>}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && <button className="btn-secondary" onClick={async () => {
            const { data } = await supabase.from('campaigns').select('*').eq('id', id!).single()
            const { data: nd } = await supabase.from('campaigns').insert({ name: `${c.name} (copy)`, subject: c.subject, from_name: c.from_name, from_email: c.from_email, html: c.html, status: 'draft' }).select().single()
            if (nd) { toast.success('Duplicated'); nav(`/campaigns/${nd.id}`) }
          }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Copy size={14} /> Duplicate</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'wizard' ? 'active' : ''}`} onClick={() => setActiveTab('wizard')}>Campaign Setup</button>
        <button className={`tab ${activeTab === 'report' ? 'active' : ''}`} onClick={() => { setActiveTab('report'); if (hasReport) loadReport() }}>
          <BarChart2 size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Report
        </button>
      </div>

      {activeTab === 'wizard' && (
        <>
          {/* Step indicators */}
          <div className="steps" style={{ marginBottom: 32 }}>
            {STEPS.map((s, i) => (
              <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className={`step-btn ${s.key === step ? 'active' : i < stepIdx ? 'done' : ''}`} onClick={() => setStep(s.key)}>{s.label}</button>
                {i < STEPS.length - 1 && <ChevronRight size={14} color="var(--text2)" />}
              </span>
            ))}
          </div>

          {/* Step 1: Details */}
          {step === 'details' && (
            <div style={{ maxWidth: 560 }}>
              <div className="form-group">
                <label>Campaign name (internal only)</label>
                <input value={c.name} disabled={isLocked} onChange={e => setC({ ...c, name: e.target.value })} onBlur={() => update({ name: c.name })} />
              </div>
              <div className="form-group">
                <label>Subject line</label>
                <input value={c.subject} disabled={isLocked} onChange={e => setC({ ...c, subject: e.target.value })} onBlur={() => update({ subject: c.subject })} />
              </div>
              <div className="form-group">
                <label>Preview text</label>
                <input value={c.preview_text ?? ''} disabled={isLocked} onChange={e => setC({ ...c, preview_text: e.target.value })} onBlur={() => update({ preview_text: c.preview_text })} placeholder="Short summary shown in inbox..." />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>From name</label>
                  <input value={c.from_name} disabled={isLocked} onChange={e => setC({ ...c, from_name: e.target.value })} onBlur={() => update({ from_name: c.from_name })} />
                </div>
                <div className="form-group">
                  <label>From email</label>
                  <input value={c.from_email} disabled={isLocked} onChange={e => setC({ ...c, from_email: e.target.value })} onBlur={() => update({ from_email: c.from_email })} />
                </div>
              </div>
              <div className="form-group">
                <label>Reply-to (optional)</label>
                <input value={c.reply_to ?? ''} disabled={isLocked} onChange={e => setC({ ...c, reply_to: e.target.value })} onBlur={() => update({ reply_to: c.reply_to || null })} />
              </div>
              <button className="btn-primary" onClick={() => setStep('audience')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Next: Audience <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* Step 2: Audience */}
          {step === 'audience' && (
            <div style={{ maxWidth: 560 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Send to lists</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>Select one or more lists to include.</div>
                {!lists.length && <div style={{ fontSize: 13, color: 'var(--text2)' }}>No lists yet. <Link to="/contacts" style={{ color: 'var(--primary)' }}>Create one first</Link>.</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {lists.map(l => (
                    <label key={l.id} className="checkbox-label">
                      <input type="checkbox" checked={selectedLists.includes(l.id)} disabled={isLocked} onChange={e => {
                        const next = e.target.checked ? [...selectedLists, l.id] : selectedLists.filter(x => x !== l.id)
                        saveLists(next)
                      }} />
                      <span style={{ fontWeight: 500 }}>{l.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              {recipientCount !== null && (
                <div style={{ padding: '12px 16px', background: 'rgba(99,102,241,0.1)', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                  <strong>{fmt(recipientCount)}</strong> estimated recipients
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" onClick={() => setStep('details')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ChevronLeft size={14} /> Back</button>
                <button className="btn-primary" onClick={() => setStep('design')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Next: Design <ChevronRight size={14} /></button>
              </div>
            </div>
          )}

          {/* Step 3: Design */}
          {step === 'design' && (
            <div>
              <div style={{ maxWidth: 560, marginBottom: 16 }}>
                <label>Use a saved template</label>
                <select value={c.template_id ?? ''} onChange={e => applyTemplate(e.target.value)} disabled={isLocked}>
                  <option value="">Choose a template...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {c.template_id && (
                <div style={{ marginBottom: 16 }}>
                  <Link to={`/templates/${c.template_id}`} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                    Open template editor
                  </Link>
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label>Email preview</label>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, height: 500, overflow: 'auto', background: 'white', marginTop: 8 }}>
                  <iframe srcDoc={c.html ?? "<div style='padding:2rem;color:#888;font-family:sans-serif'>No template selected yet. Choose one above.</div>"}
                    style={{ width: '100%', height: '100%', border: 'none' }} title="preview" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" onClick={() => setStep('audience')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ChevronLeft size={14} /> Back</button>
                <button className="btn-primary" onClick={() => setStep('review')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Next: Review <ChevronRight size={14} /></button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Send */}
          {step === 'review' && (
            <div style={{ maxWidth: 560 }}>
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text2)', letterSpacing: 1, marginBottom: 16 }}>Review summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 13 }}>
                  <div style={{ color: 'var(--text2)' }}>Subject</div><div style={{ fontWeight: 600 }}>{c.subject || '—'}</div>
                  <div style={{ color: 'var(--text2)' }}>From</div><div style={{ fontWeight: 600 }}>{c.from_name} &lt;{c.from_email}&gt;</div>
                  <div style={{ color: 'var(--text2)' }}>Lists</div><div style={{ fontWeight: 600 }}>{selectedLists.length ? `${selectedLists.length} list(s)` : 'None selected'}</div>
                  <div style={{ color: 'var(--text2)' }}>Recipients</div><div style={{ fontWeight: 600 }}>{recipientCount !== null ? fmt(recipientCount) : '—'}</div>
                  <div style={{ color: 'var(--text2)' }}>Template</div><div style={{ fontWeight: 600 }}>{c.html ? '✓ Ready' : '✗ Missing'}</div>
                </div>
              </div>

              {canEdit && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Send test email</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>Send a preview to up to 5 addresses. Not counted in analytics.</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input placeholder="email1@test.com, email2@test.com" value={testEmails} onChange={e => setTestEmails(e.target.value)} style={{ flex: 1 }} />
                    <button className="btn-secondary" onClick={sendTest} disabled={testSending}>{testSending ? 'Sending...' : 'Send test'}</button>
                  </div>
                </div>
              )}

              {canEdit && c.status === 'draft' && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Send size={14} /> Send now</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>Queues all {recipientCount !== null ? fmt(recipientCount) : '?'} recipients immediately.</div>
                  <button className="btn-primary" onClick={sendNow} disabled={!c.html || !c.subject || !selectedLists.length}>Send campaign now</button>
                </div>
              )}

              {canEdit && c.status === 'draft' && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Schedule send</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>Pick a future date and time.</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} style={{ maxWidth: 240 }} />
                    <button className="btn-secondary" onClick={schedule} disabled={!c.html || !c.subject || !selectedLists.length || !scheduleAt}>Schedule</button>
                  </div>
                </div>
              )}

              {c.status === 'scheduled' && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>Scheduled for {new Date(c.scheduled_at!).toLocaleString()}</p>
                  <button className="btn-secondary" style={{ marginTop: 12 }} onClick={() => update({ status: 'cancelled' })}>Cancel schedule</button>
                </div>
              )}

              <button className="btn-secondary" onClick={() => setStep('design')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ChevronLeft size={14} /> Back</button>
            </div>
          )}
        </>
      )}

      {/* Report Tab */}
      {activeTab === 'report' && (
        <div>
          {!hasReport ? (
            <div className="empty-state card">
              <BarChart2 size={40} style={{ opacity: 0.3, margin: '0 auto 16px', display: 'block' }} />
              <p>Report will be available after the campaign is sent.</p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                  { l: 'Recipients', v: fmt(c.total_recipients) },
                  { l: 'Sent', v: fmt(c.total_sent) },
                  { l: 'Unique opens', v: fmt(c.total_opened) },
                  { l: 'Open rate', v: pct(c.total_opened, c.total_sent) },
                  { l: 'Unique clicks', v: fmt(c.total_clicked) },
                  { l: 'Click rate', v: pct(c.total_clicked, c.total_sent) },
                  { l: 'Bounces', v: fmt(c.total_bounced) },
                  { l: 'Unsubscribes', v: fmt(c.total_unsubscribed) },
                ].map(s => (
                  <div key={s.l} className="stat-card">
                    <div className="stat-label">{s.l}</div>
                    <div className="stat-value" style={{ fontSize: 22 }}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 16 }}>Opens & clicks over time</div>
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={reportEvents}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="day" stroke="var(--text2)" fontSize={11} />
                      <YAxis stroke="var(--text2)" fontSize={11} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                      <Line type="monotone" dataKey="opens" stroke="var(--primary)" strokeWidth={2} dot={false} name="Opens" />
                      <Line type="monotone" dataKey="clicks" stroke="var(--green)" strokeWidth={2} dot={false} name="Clicks" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
