import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { toast } from 'sonner'
import { Shield, Server, UserPlus, User } from 'lucide-react'

interface UserRole { id: string; user_id: string; role: string; email?: string }

export default function Settings() {
  const { isSuperAdmin, user } = useAuth()
  const [users, setUsers] = useState<UserRole[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('campaign_manager')
  const [inviting, setInviting] = useState(false)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('user_roles').select('id,user_id,role')
    setUsers((data ?? []) as UserRole[])
  }

  useEffect(() => { if (isSuperAdmin) load() }, [isSuperAdmin])

  const invite = async () => {
    if (!inviteEmail.trim()) { toast.error('Enter an email'); return }
    setInviting(true)
    // Try to create pending invite - gracefully handle if table doesn't exist
    const { error } = await supabase.from('pending_invites').insert({
      email: inviteEmail.trim().toLowerCase(), role: inviteRole, invited_by: user?.id
    })
    setInviting(false)
    if (error) {
      toast.info(`Share your app URL with ${inviteEmail} and ask them to sign up. Then assign their role below.`)
    } else {
      toast.success(`Invite recorded for ${inviteEmail}`)
      setInviteEmail('')
    }
  }

  const setRole = async (userId: string, role: string) => {
    await supabase.from('user_roles').delete().eq('user_id', userId)
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role })
    if (error) toast.error(error.message); else { toast.success('Role updated'); load() }
  }

  const removeUser = async (userId: string) => {
    if (!confirm('Remove this user\'s access?')) return
    await supabase.from('user_roles').delete().eq('user_id', userId)
    toast.success('Access removed'); load()
  }

  const changePassword = async () => {
    if (!pwNew || pwNew.length < 6) { toast.error('New password must be at least 6 characters'); return }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pwNew })
    setPwLoading(false)
    if (error) toast.error(error.message)
    else { toast.success('Password updated'); setPwCurrent(''); setPwNew('') }
  }

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-title" style={{ marginBottom: 32 }}>Settings</div>

      {/* Account */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><User size={16} /> Your account</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>{user?.email}</div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Change password</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="password" placeholder="New password (min 6 chars)" value={pwNew} onChange={e => setPwNew(e.target.value)} style={{ maxWidth: 260 }} />
            <button className="btn-primary" onClick={changePassword} disabled={pwLoading}>{pwLoading ? 'Saving...' : 'Update password'}</button>
          </div>
        </div>
      </div>

      {/* Team */}
      {isSuperAdmin && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><UserPlus size={16} /> Invite team member</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input placeholder="colleague@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ maxWidth: 260 }} />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ width: 180 }}>
                <option value="campaign_manager">Campaign Manager</option>
                <option value="viewer">Viewer</option>
              </select>
              <button className="btn-primary" onClick={invite} disabled={inviting}>{inviting ? 'Sending...' : 'Invite'}</button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><Shield size={16} /> Team members</div>
            {users.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{u.email || u.user_id.slice(0, 8) + '...'}</div>
                </div>
                <select value={u.role} onChange={e => setRole(u.user_id, e.target.value)} style={{ width: 180 }}>
                  <option value="super_admin">Super Admin</option>
                  <option value="campaign_manager">Campaign Manager</option>
                  <option value="viewer">Viewer</option>
                </select>
                {u.user_id !== user?.id && (
                  <button className="btn-ghost" style={{ color: 'var(--red)', fontSize: 13 }} onClick={() => removeUser(u.user_id)}>Remove</button>
                )}
              </div>
            ))}
            {!users.length && <div style={{ fontSize: 13, color: 'var(--text2)' }}>No team members yet.</div>}
          </div>
        </>
      )}

      {/* AWS Config */}
      <div className="card">
        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><Server size={16} /> AWS SES configuration</div>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>Set these environment variables on your hosting platform to enable real email sending:</p>
        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 16, fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
          {['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_REGION','SES_FROM_EMAIL','SES_CONFIGURATION_SET','APP_BASE_URL','TRACKING_SECRET'].map(k => (
            <div key={k} style={{ marginBottom: 6, color: 'var(--text2)' }}>{k}=<span style={{ color: 'var(--text)' }}>your_value</span></div>
          ))}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 16, marginBottom: 8 }}>SNS webhook URL for bounce/complaint events:</p>
        <code style={{ fontSize: 12, background: 'var(--surface2)', padding: '6px 10px', borderRadius: 6 }}>
          {window.location.origin}/api/public/ses/webhook
        </code>
      </div>
    </div>
  )
}
