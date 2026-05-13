import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { toast } from 'sonner'
import { Plus, Trash2, Users } from 'lucide-react'

interface Segment { id: string; name: string; rules: unknown; created_at: string }
interface Rule { field: string; op: string; value: string }

const FIELDS = ['status','source','email','first_name','last_name']
const OPS = ['equals','not_equals','contains','not_contains','starts_with']

export default function Segments() {
  const { canEdit, isSuperAdmin } = useAuth()
  const [segments, setSegments] = useState<Segment[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [rules, setRules] = useState<Rule[]>([{ field: 'status', op: 'equals', value: 'active' }])
  const [logic, setLogic] = useState<'AND'|'OR'>('AND')

  const load = async () => {
    const { data } = await supabase.from('segments').select('*').order('created_at', { ascending: false })
    setSegments((data ?? []) as Segment[])
    // Load counts
    const cs: Record<string, number> = {}
    for (const s of data ?? []) {
      const count = await getCount((s as Segment).rules as { logic: string; conditions: Rule[] })
      cs[s.id] = count
    }
    setCounts(cs)
  }

  useEffect(() => { load() }, [])

  const getCount = async (rules: { logic: string; conditions: Rule[] }) => {
    if (!rules?.conditions?.length) return 0
    let q = supabase.from('contacts').select('*', { count: 'exact', head: true })
    for (const r of rules.conditions) {
      if (r.op === 'equals') q = q.eq(r.field, r.value)
      else if (r.op === 'not_equals') q = q.neq(r.field, r.value)
      else if (r.op === 'contains') q = q.ilike(r.field, `%${r.value}%`)
    }
    const { count } = await q
    return count ?? 0
  }

  const save = async () => {
    if (!name.trim()) { toast.error('Enter a name'); return }
    const { error } = await supabase.from('segments').insert({
      name: name.trim(), rules: { logic, conditions: rules }
    })
    if (error) toast.error(error.message)
    else { toast.success('Segment created'); setShowAdd(false); setName(''); setRules([{ field: 'status', op: 'equals', value: 'active' }]); load() }
  }

  const del = async (id: string) => {
    if (!confirm('Delete segment?')) return
    await supabase.from('segments').delete().eq('id', id)
    toast.success('Deleted'); load()
  }

  const addRule = () => setRules([...rules, { field: 'status', op: 'equals', value: '' }])
  const updateRule = (i: number, patch: Partial<Rule>) => setRules(rules.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const removeRule = (i: number) => setRules(rules.filter((_, idx) => idx !== i))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Segments</div>
          <div className="page-sub">Smart filters to target specific contacts</div>
        </div>
        {canEdit && <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> New segment</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {segments.map(s => (
          <div key={s.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div>
              {isSuperAdmin && <button className="btn-ghost" style={{ padding: '4px 8px', color: 'var(--red)' }} onClick={() => del(s.id)}><Trash2 size={13} /></button>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, color: 'var(--text2)', fontSize: 13 }}>
              <Users size={14} />
              <span>{counts[s.id] !== undefined ? `${counts[s.id].toLocaleString()} contacts` : 'Counting...'}</span>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text2)' }}>
              {Array.isArray((s.rules as any)?.conditions) && (s.rules as any).conditions.map((r: Rule, i: number) => (
                <div key={i} style={{ padding: '4px 0' }}>
                  {i > 0 && <span style={{ color: 'var(--primary)', fontWeight: 600, marginRight: 4 }}>{(s.rules as any).logic}</span>}
                  <span>{r.field} {r.op.replace('_', ' ')} "{r.value}"</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 12 }}>Created {new Date(s.created_at).toLocaleDateString()}</div>
          </div>
        ))}
        {!segments.length && (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <Users size={40} />
            <p>No segments yet. Create one to target specific contacts.</p>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">New segment</div>
            <div className="form-group"><label>Segment name</label><input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="e.g. Active subscribers" /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>Match</span>
              <select value={logic} onChange={e => setLogic(e.target.value as 'AND'|'OR')} style={{ width: 80 }}>
                <option value="AND">ALL</option>
                <option value="OR">ANY</option>
              </select>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>of these conditions:</span>
            </div>
            {rules.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <select value={r.field} onChange={e => updateRule(i, { field: e.target.value })} style={{ width: 140 }}>
                  {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={r.op} onChange={e => updateRule(i, { op: e.target.value })} style={{ width: 140 }}>
                  {OPS.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                </select>
                <input value={r.value} onChange={e => updateRule(i, { value: e.target.value })} placeholder="value" style={{ flex: 1 }} />
                {rules.length > 1 && <button className="btn-ghost" style={{ padding: '6px 8px', color: 'var(--red)' }} onClick={() => removeRule(i)}>✕</button>}
              </div>
            ))}
            <button className="btn-secondary" onClick={addRule} style={{ marginBottom: 20, fontSize: 13 }}>+ Add condition</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={save}>Create segment</button>
              <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
