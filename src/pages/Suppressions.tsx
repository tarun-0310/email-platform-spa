import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { toast } from 'sonner'
import { Plus, Trash2, Search, Download, ShieldOff } from 'lucide-react'

interface Suppression { id: string; email: string; reason: string; suppressed_at: string }

export default function Suppressions() {
  const { isSuperAdmin } = useAuth()
  const [items, setItems] = useState<Suppression[]>([])
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('manual')

  const load = async () => {
    let q = supabase.from('suppression_list').select('*', { count: 'exact' }).order('suppressed_at', { ascending: false })
    if (search) q = q.ilike('email', `%${search}%`)
    const { data, count } = await q
    setItems((data ?? []) as Suppression[])
    setTotal(count ?? 0)
  }

  useEffect(() => { load() }, [search])

  const add = async () => {
    if (!email.trim()) { toast.error('Enter an email'); return }
    const { error } = await supabase.from('suppression_list').insert({ email: email.trim().toLowerCase(), reason })
    if (error) toast.error(error.message)
    else { toast.success('Added to suppression list'); setEmail(''); setShowAdd(false); load() }
  }

  const remove = async (id: string) => {
    if (!confirm('Remove from suppression list?')) return
    await supabase.from('suppression_list').delete().eq('id', id)
    toast.success('Removed'); load()
  }

  const exportCSV = () => {
    const header = 'email,reason,suppressed_at'
    const rows = items.map(s => `${s.email},${s.reason},${s.suppressed_at}`)
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'suppressions.csv'; a.click()
  }

  const REASON_COLORS: Record<string, string> = { bounced: 'badge-failed', complained: 'badge-failed', unsubscribed: 'badge-cancelled', manual: 'badge-draft' }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Suppression List</div>
          <div className="page-sub">{total.toLocaleString()} suppressed addresses — these will never receive emails</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Download size={14} /> Export</button>
          {isSuperAdmin && <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> Add email</button>}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div className="search-wrap" style={{ maxWidth: 320 }}>
          <Search size={14} />
          <input placeholder="Search email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr><th>Email</th><th>Reason</th><th>Suppressed</th>{isSuperAdmin && <th></th>}</tr>
          </thead>
          <tbody>
            {items.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 500 }}>{s.email}</td>
                <td><span className={`badge ${REASON_COLORS[s.reason] ?? 'badge-draft'}`}>{s.reason}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(s.suppressed_at).toLocaleString()}</td>
                {isSuperAdmin && <td><button className="btn-ghost" style={{ padding: '4px 8px', color: 'var(--red)' }} onClick={() => remove(s.id)}><Trash2 size={13} /></button></td>}
              </tr>
            ))}
            {!items.length && (
              <tr><td colSpan={4}>
                <div className="empty-state"><ShieldOff size={36} /><p>No suppressed addresses.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add to suppression list</div>
            <div className="form-group"><label>Email address</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus /></div>
            <div className="form-group">
              <label>Reason</label>
              <select value={reason} onChange={e => setReason(e.target.value)}>
                <option value="manual">Manual</option>
                <option value="bounced">Bounced</option>
                <option value="complained">Complained</option>
                <option value="unsubscribed">Unsubscribed</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={add}>Add</button>
              <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
