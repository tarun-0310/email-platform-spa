import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Mail } from 'lucide-react'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const { signUp } = useAuth()
  const nav = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await signUp(email, password, fullName)
    setLoading(false)
    if (error) setError(error)
    else setDone(true)
  }

  if (done) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <Mail size={40} color="var(--primary)" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Check your email</h2>
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</p>
        <button className="btn-primary" style={{ marginTop: 24, width: '100%' }} onClick={() => nav('/login')}>Go to login</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            <Mail size={28} color="var(--primary)" />
            <span style={{ fontSize: 24, fontWeight: 700 }}>Postmark</span>
          </div>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>Create your account</p>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" required />
            </div>
            <div className="form-group">
              <label>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} />
            </div>
            {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16, padding: '10px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>{error}</div>}
            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '10px 16px' }} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Create account'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text2)' }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--primary)' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
