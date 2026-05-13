import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { toast } from 'sonner'
import { Plus, Edit3, Trash2, Copy, Sparkles, Search, FileText } from 'lucide-react'

interface Template { id: string; name: string; subject: string | null; category: string | null; updated_at: string }

const STARTER_TEMPLATES = [
  { name: 'Welcome email', category: 'transactional', subject: 'Welcome to {{company_name}}!', html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#4f46e5;color:#fff;padding:32px;text-align:center"><h1>Welcome, {{first_name}}!</h1><p>We're thrilled to have you.</p></div><div style="padding:32px;color:#333"><p>Hi {{first_name}},</p><p>Thank you for joining us! Your account is ready.</p><a href="#" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;margin-top:16px">Get Started →</a></div><div style="text-align:center;padding:24px;color:#888;font-size:12px;border-top:1px solid #eee"><a href="{{unsubscribe_url}}">Unsubscribe</a></div></div>` },
  { name: 'Newsletter', category: 'newsletter', subject: 'Monthly update', html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff"><div style="padding:32px;border-bottom:3px solid #111;text-align:center"><h1 style="font-size:28px;margin:0">The Monthly Brief</h1></div><div style="padding:32px;color:#222;line-height:1.8"><p>Hello {{first_name}},</p><h2>This month's highlights</h2><p>Add your top story content here.</p><h2>Product updates</h2><p>Describe any new features shipped this month.</p></div><div style="background:#111;color:#aaa;text-align:center;padding:24px;font-size:12px"><a href="{{unsubscribe_url}}" style="color:#aaa">Unsubscribe</a></div></div>` },
  { name: 'Promotional offer', category: 'promotional', subject: '🔥 Exclusive offer just for you', html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden"><div style="background:linear-gradient(135deg,#ff6b35,#f7c948);padding:48px 32px;text-align:center;color:#fff"><h1 style="font-size:36px;margin:0;font-weight:900">50% OFF</h1><p>Your exclusive discount code inside</p></div><div style="padding:40px 32px;text-align:center"><p style="font-size:32px;font-weight:900;color:#ff6b35;letter-spacing:2px">SAVE50</p><a href="#" style="display:inline-block;background:#ff6b35;color:#fff;padding:16px 40px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:18px;margin-top:16px">Shop Now →</a></div><div style="text-align:center;padding:20px;color:#aaa;font-size:11px"><a href="{{unsubscribe_url}}" style="color:#aaa">Unsubscribe</a></div></div>` },
  { name: 'Event invite', category: 'event', subject: "You're invited!", html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden"><div style="background:#1e293b;color:#fff;padding:40px 32px;text-align:center"><div style="font-size:48px">🎉</div><h1 style="margin:16px 0 0">You're invited!</h1><p style="color:#94a3b8">We'd love to have you join us</p></div><div style="padding:36px 32px;color:#334155"><p>Hi {{first_name}},</p><div style="background:#f8fafc;border-radius:8px;padding:20px;margin:24px 0"><p><strong>Date:</strong> Add date here</p><p><strong>Time:</strong> Add time here</p><p><strong>Location:</strong> Add location</p></div><a href="#" style="display:block;text-align:center;background:#4f46e5;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold">RSVP Now →</a></div><div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px"><a href="{{unsubscribe_url}}" style="color:#94a3b8">Unsubscribe</a></div></div>` },
  { name: 'Training notice', category: 'transactional', subject: 'Training session notice', html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden"><div style="background:#0f766e;color:#fff;padding:32px;display:flex;align-items:center;gap:16px"><div style="font-size:40px">🎓</div><div><h1 style="margin:0;font-size:22px">Training Notice</h1><p style="margin:4px 0 0;opacity:0.8;font-size:14px">Required session for your team</p></div></div><div style="padding:32px;color:#334155;line-height:1.7"><p>Dear {{first_name}},</p><p>You have been enrolled in the upcoming training session.</p><div style="background:#f0fdf4;border-left:4px solid #0f766e;padding:16px 20px;margin:20px 0"><p><strong>Session:</strong> Add topic here</p><p><strong>Date:</strong> Add date here</p><p><strong>Format:</strong> Online / In-person</p></div></div><div style="background:#f8fafc;text-align:center;padding:20px;color:#94a3b8;font-size:12px"><a href="{{unsubscribe_url}}" style="color:#94a3b8">Unsubscribe</a></div></div>` },
]

const CATEGORIES = ['all', 'newsletter', 'promotional', 'transactional', 'event']

export default function Templates() {
  const { canEdit, isSuperAdmin, user } = useAuth()
  const nav = useNavigate()
  const [items, setItems] = useState<Template[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [seeding, setSeeding] = useState(false)

  const load = async () => {
    let q = supabase.from('templates').select('id,name,subject,category,updated_at').order('updated_at', { ascending: false })
    if (search) q = q.ilike('name', `%${search}%`)
    if (category !== 'all') q = q.eq('category', category)
    const { data } = await q
    setItems((data ?? []) as Template[])
  }

  useEffect(() => { load() }, [search, category])

  const create = async () => {
    const { data, error } = await supabase.from('templates').insert({
      name: 'Untitled template', subject: 'Subject', html: '<p>Start designing...</p>', category: 'transactional', created_by: user!.id,
    }).select().single()
    if (error) { toast.error(error.message); return }
    nav(`/templates/${data.id}`)
  }

  const duplicate = async (t: Template) => {
    const { data: orig } = await supabase.from('templates').select('*').eq('id', t.id).single()
    if (!orig) return
    const { data, error } = await supabase.from('templates').insert({
      name: `${t.name} (copy)`, subject: orig.subject, html: orig.html, category: orig.category, created_by: user!.id,
    }).select().single()
    if (error) { toast.error(error.message); return }
    toast.success('Duplicated')
    nav(`/templates/${data.id}`)
  }

  const del = async (id: string) => {
    if (!confirm('Delete this template?')) return
    const { error } = await supabase.from('templates').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
  }

  const seedStarters = async () => {
    setSeeding(true)
    for (const t of STARTER_TEMPLATES) {
      await supabase.from('templates').insert({ ...t, created_by: user!.id })
    }
    toast.success('5 starter templates added!')
    setSeeding(false)
    load()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Templates</div>
          <div className="page-sub">Design once, reuse across campaigns.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && items.length === 0 && (
            <button className="btn-secondary" onClick={seedStarters} disabled={seeding}>
              <Sparkles size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              {seeding ? 'Adding...' : 'Add 5 starter templates'}
            </button>
          )}
          {canEdit && (
            <button className="btn-primary" onClick={create}>
              <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              New Template
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="search-wrap" style={{ flex: 1, maxWidth: 320 }}>
          <Search size={14} />
          <input placeholder="Search templates..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: 180 }}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {items.map(t => (
          <div key={t.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ aspectRatio: '4/3', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', flexDirection: 'column', gap: 8 }}>
              <FileText size={32} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: 12, opacity: 0.5 }}>No preview</span>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject || 'No subject'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                {t.category && <span className="badge badge-scheduled" style={{ fontSize: 10 }}>{t.category}</span>}
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>Updated {new Date(t.updated_at).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {canEdit && (
                  <button className="btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => nav(`/templates/${t.id}`)}>
                    <Edit3 size={12} /> Edit
                  </button>
                )}
                {canEdit && (
                  <button className="btn-ghost" onClick={() => duplicate(t)} title="Duplicate" style={{ padding: '8px 10px' }}>
                    <Copy size={14} />
                  </button>
                )}
                {isSuperAdmin && (
                  <button className="btn-ghost" onClick={() => del(t.id)} title="Delete" style={{ padding: '8px 10px', color: 'var(--red)' }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {!items.length && (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <FileText size={40} />
            <p>No templates yet.</p>
            {canEdit && <button className="btn-secondary" onClick={seedStarters} disabled={seeding} style={{ marginTop: 16 }}><Sparkles size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />{seeding ? 'Adding...' : 'Add 5 starter templates'}</button>}
          </div>
        )}
      </div>
    </div>
  )
}
