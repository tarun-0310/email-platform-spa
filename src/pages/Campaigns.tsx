import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { toast } from 'sonner'
import { Plus, Eye, Copy, Trash2, Search } from 'lucide-react'

interface Campaign {
  id: string; name: string; subject: string; status: string;
  scheduled_at: string | null; sent_at: string | null; created_at: string;
  total_recipients: number; total_sent: number; total_opened: number; total_clicked: number;
}

function fmt(n: number) { return n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n||0) }
function pct(a: number, b: number) { return b ? `${((a/b)*100).toFixed(1)}%` : '—' }

const STATUS_COLORS: Record<string, string> = {
  draft: 'badge-draft', scheduled: 'badge-scheduled', sending: 'badge-sending',
  sent: 'badge-sent', paused: 'badge-paused', cancelled: 'badge-cancelled', failed: 'badge-failed',
}

export default function Campaigns() {
  const { canEdit, isSuperAdmin, user } = useAuth()
  const nav = useNavigate()
  const [items, setItems] = useState<Campaign[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const load = async () => {
    let q = supabase.from('campaigns').select('*').order('created_at', { ascending: false })
    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    if (search) q = q.ilike('name', `%${search}%`)
    const { data } = await q
    setItems((data ?? []) as Campaign[])
  }

  useEffect(() => { load() }, [search, statusFilter])

  const create = async () => {
    const { data, error } = await supabase.from('campaigns').insert({
      name: 'Untitled campaign', subject: '', from_name: 'Your Brand',
      from_email: 'you@example.com', status: 'draft', created_by: user!.id,
    }).select().single()
    if (error) { toast.error(error.message); return }
    nav(`/campaigns/${data.id}`)
  }

  const duplicate = async (c: Campaign) => {
    const { data: orig } = await supabase.from('campaigns').select('*').eq('id', c.id).single()
    if (!orig) return
    const { data, error } = await supabase.from('campaigns').insert({
      name: `${c.name} (copy)`, subject: orig.subject, from_name: orig.from_name,
      from_email: orig.from_email, status: 'draft', created_by: user!.id,
    }).select().single()
    if (error) { toast.error(error.message); return }
    toast.success('Duplicated')
    nav(`/campaigns/${data.id}`)
  }

  const del = async (id: string) => {
    if (!confirm('Delete this draft?')) return
    const { error } = await supabase.from('campaigns').delete().eq('id', id).eq('status', 'draft')
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Campaigns</div>
          <div className="page-sub">{items.length} total</div>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={create} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> New campaign
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="search-wrap" style={{ flex: 1, maxWidth: 320 }}>
          <Search size={14} />
          <input placeholder="Search campaigns..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 160 }}>
          <option value="all">All statuses</option>
          {['draft','scheduled','sending','sent','paused','cancelled','failed'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Name / Subject</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Recipients</th>
              <th style={{ textAlign: 'right' }}>Open rate</th>
              <th style={{ textAlign: 'right' }}>Click rate</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(c => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/campaigns/${c.id}`)}>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{c.subject || 'No subject'}</div>
                </td>
                <td><span className={`badge ${STATUS_COLORS[c.status] ?? 'badge-draft'}`}>{c.status}</span></td>
                <td style={{ textAlign: 'right' }}>{fmt(c.total_recipients)}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{pct(c.total_opened, c.total_sent)}</td>
                <td style={{ textAlign: 'right' }}>{pct(c.total_clicked, c.total_sent)}</td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {c.sent_at ? new Date(c.sent_at).toLocaleDateString() :
                   c.scheduled_at ? `Sched. ${new Date(c.scheduled_at).toLocaleDateString()}` :
                   new Date(c.created_at).toLocaleDateString()}
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn-ghost" onClick={() => nav(`/campaigns/${c.id}`)} style={{ padding: '6px 8px' }} title="View"><Eye size={14} /></button>
                    {canEdit && <button className="btn-ghost" onClick={() => duplicate(c)} style={{ padding: '6px 8px' }} title="Duplicate"><Copy size={14} /></button>}
                    {isSuperAdmin && c.status === 'draft' && <button className="btn-ghost" onClick={() => del(c.id)} style={{ padding: '6px 8px', color: 'var(--red)' }} title="Delete"><Trash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--text2)' }}>
                {search || statusFilter !== 'all' ? 'No campaigns match your filters.' : 'No campaigns yet. Create your first one!'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
