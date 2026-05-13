import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { Users, Mail, Eye, MousePointerClick, AlertTriangle, AlertCircle, TrendingUp, Activity } from 'lucide-react'

function fmt(n: number) { return n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n) }
function pct(a: number, b: number) { return b ? `${((a/b)*100).toFixed(1)}%` : '0.0%' }

export default function Dashboard() {
  const [stats, setStats] = useState({ contacts: 0, contactGrowth: 0, sent: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0 })
  const [series, setSeries] = useState<{ day: string; sent: number; opened: number }[]>([])
  const [topCampaigns, setTopCampaigns] = useState<{ id: string; name: string; total_sent: number; total_opened: number }[]>([])
  const [activity, setActivity] = useState<{ id: string; event_type: string; occurred_at: string }[]>([])

  useEffect(() => {
    ;(async () => {
      const ago30 = new Date(Date.now() - 30 * 86400000).toISOString()
      const [{ count: contacts }, { count: newContacts }, cRes, eRes, topRes, actRes] = await Promise.all([
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).gte('created_at', ago30),
        supabase.from('campaigns').select('total_sent,total_opened,total_clicked,total_bounced,total_complained,total_unsubscribed'),
        supabase.from('email_events').select('event_type,occurred_at').gte('occurred_at', ago30),
        supabase.from('campaigns').select('id,name,total_sent,total_opened').in('status', ['sent','sending']).order('total_opened', { ascending: false }).limit(5),
        supabase.from('email_events').select('id,event_type,occurred_at').order('occurred_at', { ascending: false }).limit(15),
      ])
      const totals = (cRes.data ?? []).reduce((a, c) => ({
        sent: a.sent + (c.total_sent||0), opened: a.opened + (c.total_opened||0),
        clicked: a.clicked + (c.total_clicked||0), bounced: a.bounced + (c.total_bounced||0),
        complained: a.complained + (c.total_complained||0), unsubscribed: a.unsubscribed + (c.total_unsubscribed||0),
      }), { sent: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0 })
      setStats({ contacts: contacts ?? 0, contactGrowth: newContacts ?? 0, ...totals })
      setTopCampaigns(topRes.data ?? [])
      setActivity(actRes.data ?? [])
      const map: Record<string, { sent: number; opened: number }> = {}
      for (let i = 29; i >= 0; i--) {
        const k = new Date(Date.now() - i * 86400000).toISOString().slice(5, 10)
        map[k] = { sent: 0, opened: 0 }
      }
      ;(eRes.data ?? []).forEach((e: { event_type: string; occurred_at: string }) => {
        const k = new Date(e.occurred_at).toISOString().slice(5, 10)
        if (!map[k]) return
        if (e.event_type === 'sent') map[k].sent++
        if (e.event_type === 'opened') map[k].opened++
      })
      setSeries(Object.entries(map).map(([day, v]) => ({ day, ...v })))
    })()
  }, [])

  const bounceRate = stats.sent ? (stats.bounced / stats.sent) * 100 : 0
  const complaintRate = stats.sent ? (stats.complained / stats.sent) * 100 : 0

  const ICONS: Record<string, string> = { sent: '📨', delivered: '✅', opened: '👁', clicked: '🖱', bounced: '⚠️', complained: '🚫', unsubscribed: '🔕', failed: '❌' }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Overview of your email program</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Active contacts', value: fmt(stats.contacts), sub: `+${fmt(stats.contactGrowth)} this month`, icon: Users },
          { label: 'Emails sent', value: fmt(stats.sent), icon: Mail },
          { label: 'Avg open rate', value: pct(stats.opened, stats.sent), sub: `${fmt(stats.opened)} opens · target >20%`, icon: Eye },
          { label: 'Avg click rate', value: pct(stats.clicked, stats.sent), sub: `target >2%`, icon: MousePointerClick },
          { label: 'Bounce rate', value: `${bounceRate.toFixed(2)}%`, sub: bounceRate >= 2 ? '⚠ Above 2%!' : 'Keep below 2%', icon: AlertTriangle, alert: bounceRate >= 2 },
          { label: 'Complaint rate', value: `${complaintRate.toFixed(3)}%`, sub: complaintRate >= 0.1 ? '⚠ Above 0.1%!' : 'Keep below 0.1%', icon: AlertCircle, alert: complaintRate >= 0.1 },
          { label: 'Unsubscribes', value: fmt(stats.unsubscribed), sub: pct(stats.unsubscribed, stats.sent) + ' rate', icon: TrendingUp },
          { label: 'Complaints', value: fmt(stats.complained), icon: AlertCircle },
        ].map(({ label, value, sub, icon: Icon, alert }) => (
          <div key={label} className="stat-card" style={alert ? { borderColor: 'var(--red)', background: 'rgba(239,68,68,0.05)' } : {}}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="stat-label" style={alert ? { color: 'var(--red)' } : {}}>{label}</div>
              <Icon size={14} color={alert ? 'var(--red)' : 'var(--text2)'} />
            </div>
            <div className="stat-value" style={alert ? { color: 'var(--red)' } : {}}>{value}</div>
            {sub && <div className="stat-sub">{sub}</div>}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 16 }}>Email activity (last 30 days)</div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" stroke="var(--text2)" fontSize={11} />
              <YAxis stroke="var(--text2)" fontSize={11} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Line type="monotone" dataKey="sent" stroke="var(--primary)" strokeWidth={2} dot={false} name="Sent" />
              <Line type="monotone" dataKey="opened" stroke="var(--green)" strokeWidth={2} dot={false} name="Opened" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Top 5 campaigns by opens</div>
          {topCampaigns.length ? topCampaigns.map((c, i) => (
            <Link key={c.id} to={`/campaigns/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{i+1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>{fmt(c.total_sent)} sent</div>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>{pct(c.total_opened, c.total_sent)}</div>
            </Link>
          )) : <div className="text-muted text-sm">No sent campaigns yet.</div>}
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={16} /> Recent activity</div>
          {activity.length ? activity.map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ fontSize: 16 }}>{ICONS[e.event_type] ?? '•'}</span>
              <span style={{ flex: 1, textTransform: 'capitalize' }}>{e.event_type}</span>
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>{new Date(e.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )) : <div className="text-muted text-sm">No recent events.</div>}
        </div>
      </div>
    </div>
  )
}
