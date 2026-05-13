import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { toast } from 'sonner'
import { Plus, Trash2, Search, Upload, Download, X, ChevronDown, ChevronUp } from 'lucide-react'

interface Contact {
  id: string; email: string; first_name: string | null; last_name: string | null;
  phone: string | null; status: string; source: string; created_at: string;
}
interface ContactList { id: string; name: string }

const STATUS_COLORS: Record<string, string> = {
  active: 'badge-sent', unsubscribed: 'badge-cancelled', bounced: 'badge-failed', complained: 'badge-failed',
}

export default function Contacts() {
  const { canEdit, isSuperAdmin, user } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [lists, setLists] = useState<ContactList[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [listFilter, setListFilter] = useState('all')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const PAGE = 50
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showListModal, setShowListModal] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', phone: '' })
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ added: number; skipped: number; total: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    let q = supabase.from('contacts').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
    if (search) q = q.ilike('email', `%${search}%`)
    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    if (listFilter !== 'all') {
      const { data: members } = await supabase.from('list_memberships').select('contact_id').eq('list_id', listFilter)
      const ids = (members ?? []).map((m: { contact_id: string }) => m.contact_id)
      if (ids.length) q = q.in('id', ids)
      else { setContacts([]); setTotal(0); return }
    }
    const { data, count } = await q
    setContacts((data ?? []) as Contact[])
    setTotal(count ?? 0)
  }

  const loadLists = async () => {
    const { data } = await supabase.from('contact_lists').select('id,name').order('name')
    setLists((data ?? []) as ContactList[])
  }

  useEffect(() => { load() }, [search, statusFilter, listFilter, page])
  useEffect(() => { loadLists() }, [])

  const addContact = async () => {
    if (!form.email) { toast.error('Email is required'); return }
    const { error } = await supabase.from('contacts').insert({ ...form, status: 'active', source: 'manual' })
    if (error) toast.error(error.message)
    else { toast.success('Contact added'); setShowAdd(false); setForm({ email: '', first_name: '', last_name: '', phone: '' }); load() }
  }

  const deleteContact = async (id: string) => {
    if (!confirm('Delete this contact?')) return
    await supabase.from('contacts').delete().eq('id', id)
    toast.success('Deleted'); load()
  }

  const createList = async () => {
    if (!newListName.trim()) return
    const { error } = await supabase.from('contact_lists').insert({ name: newListName.trim() })
    if (error) toast.error(error.message)
    else { toast.success('List created'); setNewListName(''); loadLists() }
  }

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const text = await file.text()
    const lines = text.split('\n').filter(Boolean)
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    const rows = lines.slice(1)
    let added = 0, skipped = 0
    for (const row of rows) {
      const vals = row.split(',').map(v => v.trim().replace(/"/g, ''))
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = vals[i] || '' })
      const email = obj.email || obj['email address'] || obj['e-mail']
      if (!email || !email.includes('@')) { skipped++; continue }
      const { error } = await supabase.from('contacts').upsert({
        email: email.toLowerCase(), first_name: obj.first_name || obj.firstname || obj['first name'] || null,
        last_name: obj.last_name || obj.lastname || obj['last name'] || null,
        phone: obj.phone || obj.telephone || null, status: 'active', source: 'import',
      }, { onConflict: 'email', ignoreDuplicates: false })
      if (error) skipped++; else added++
      setImportProgress({ added, skipped, total: rows.length })
    }
    setImporting(false)
    toast.success(`Import done: ${added} added, ${skipped} skipped`)
    load()
  }

  const exportCSV = () => {
    const header = 'email,first_name,last_name,phone,status,source,created_at'
    const rows = contacts.map(c => `${c.email},${c.first_name||''},${c.last_name||''},${c.phone||''},${c.status},${c.source},${c.created_at}`)
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'contacts.csv'; a.click()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Contacts</div>
          <div className="page-sub">{total.toLocaleString()} total contacts</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={() => setShowListModal(true)}>Manage Lists</button>
          {canEdit && <button className="btn-secondary" onClick={() => setShowImport(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Upload size={14} /> Import CSV</button>}
          <button className="btn-secondary" onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Download size={14} /> Export</button>
          {canEdit && <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> Add contact</button>}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="search-wrap" style={{ flex: 1, maxWidth: 320 }}>
          <Search size={14} />
          <input placeholder="Search by email..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 160 }}>
          <option value="all">All statuses</option>
          {['active','unsubscribed','bounced','complained'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </select>
        <select value={listFilter} onChange={e => setListFilter(e.target.value)} style={{ width: 200 }}>
          <option value="all">All lists</option>
          {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Email</th><th>Name</th><th>Status</th><th>Source</th><th>Added</th>
              {(canEdit || isSuperAdmin) && <th></th>}
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id}>
                <td><div style={{ fontWeight: 500 }}>{c.email}</div></td>
                <td>{[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}</td>
                <td><span className={`badge ${STATUS_COLORS[c.status] ?? 'badge-draft'}`}>{c.status}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{c.source}</td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                {isSuperAdmin && <td><button className="btn-ghost" style={{ padding: '4px 8px', color: 'var(--red)' }} onClick={() => deleteContact(c.id)}><Trash2 size={13} /></button></td>}
              </tr>
            ))}
            {!contacts.length && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--text2)' }}>No contacts found.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PAGE && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button className="btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
          <span style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text2)' }}>Page {page + 1} of {Math.ceil(total / PAGE)}</span>
          <button className="btn-secondary" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add contact</div>
            <div className="form-group"><label>Email *</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoFocus /></div>
            <div className="grid-2">
              <div className="form-group"><label>First name</label><input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
              <div className="form-group"><label>Last name</label><input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
            </div>
            <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={addContact}>Add contact</button>
              <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Import contacts from CSV</div>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>Upload a CSV file with columns: email, first_name, last_name, phone. Max 25MB.</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} style={{ display: 'none' }} />
            <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={importing} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Upload size={14} /> {importing ? 'Importing...' : 'Choose CSV file'}
            </button>
            {importing && importProgress && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, marginBottom: 8, color: 'var(--text2)' }}>Processing {importProgress.added + importProgress.skipped} of {importProgress.total} rows...</div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${((importProgress.added + importProgress.skipped) / importProgress.total) * 100}%` }} /></div>
              </div>
            )}
            {!importing && importProgress && (
              <div style={{ marginTop: 16, padding: 12, background: 'rgba(34,197,94,0.1)', borderRadius: 8, fontSize: 13 }}>
                ✅ Done: <strong>{importProgress.added}</strong> added, <strong>{importProgress.skipped}</strong> skipped
              </div>
            )}
            <button className="btn-secondary" style={{ marginTop: 12 }} onClick={() => { setShowImport(false); setImportProgress(null) }}>Close</button>
          </div>
        </div>
      )}

      {/* List Manager Modal */}
      {showListModal && (
        <div className="modal-overlay" onClick={() => setShowListModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Contact Lists</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input placeholder="New list name..." value={newListName} onChange={e => setNewListName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createList()} />
              <button className="btn-primary" onClick={createList}>Create</button>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {lists.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 500 }}>{l.name}</span>
                  {isSuperAdmin && <button className="btn-ghost" style={{ padding: '4px 8px', color: 'var(--red)' }} onClick={async () => { await supabase.from('contact_lists').delete().eq('id', l.id); loadLists() }}><Trash2 size={13} /></button>}
                </div>
              ))}
              {!lists.length && <div style={{ color: 'var(--text2)', fontSize: 13, padding: '16px 0' }}>No lists yet.</div>}
            </div>
            <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => setShowListModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
