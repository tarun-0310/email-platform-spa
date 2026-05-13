import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Mail, CheckCircle, XCircle } from 'lucide-react'

export default function Unsubscribe() {
  const [params] = useSearchParams()
  const token = params.get('token') || params.get('uid') || ''
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'resubscribed'>('loading')
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); return }
    ;(async () => {
      try {
        const res = await fetch(`/api/public/unsubscribe?token=${token}`, { method: 'POST' })
        const data = await res.json()
        if (res.ok) { setEmail(data.email || ''); setStatus('success') }
        else setStatus('error')
      } catch {
        // Fallback: try to decode token and update directly
        try {
          const decoded = atob(token)
          const [contactId] = decoded.split(':')
          const { data: contact } = await supabase.from('contacts').select('email').eq('id', contactId).single()
          if (contact) {
            await supabase.from('contacts').update({ status: 'unsubscribed' }).eq('id', contactId)
            await supabase.from('suppression_list').upsert({ email: contact.email, reason: 'unsubscribed' }, { onConflict: 'email' })
            setEmail(contact.email)
            setStatus('success')
          } else setStatus('error')
        } catch { setStatus('error') }
      }
    })()
  }, [token])

  const resubscribe = async () => {
    if (!email) return
    await supabase.from('contacts').update({ status: 'active' }).eq('email', email)
    await supabase.from('suppression_list').delete().eq('email', email)
    setStatus('resubscribed')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--bg)' }}>
      <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 }}>
          <Mail size={24} color="var(--primary)" />
          <span style={{ fontSize: 20, fontWeight: 700 }}>Postmark</span>
        </div>

        {status === 'loading' && (
          <div className="card">
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text2)' }}>Processing your request...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="card">
            <CheckCircle size={48} color="var(--green)" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>You've been unsubscribed</h2>
            {email && <p style={{ color: 'var(--text2)', marginBottom: 20 }}><strong>{email}</strong> will no longer receive emails from us.</p>}
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>Changed your mind?</p>
            <button className="btn-secondary" onClick={resubscribe}>Re-subscribe</button>
          </div>
        )}

        {status === 'resubscribed' && (
          <div className="card">
            <CheckCircle size={48} color="var(--primary)" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>You're back!</h2>
            <p style={{ color: 'var(--text2)' }}>You've been successfully re-subscribed to our emails.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="card">
            <XCircle size={48} color="var(--red)" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Invalid link</h2>
            <p style={{ color: 'var(--text2)' }}>This unsubscribe link is invalid or has already been used.</p>
          </div>
        )}
      </div>
    </div>
  )
}
