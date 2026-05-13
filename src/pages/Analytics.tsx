import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from 'recharts'

function pct(a: number, b: number) { return b ? +((a / b) * 100).toFixed(2) : 0 }
function fmt(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n || 0) }

export default function Analytics() {
  const [range, setRange] = useState(30)
  const [series, setSeries] = useState<{ day: string; sent: number; opened: number; clicked: number; bounced: number }[]>([])
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; total_sent: number; total_opened: number; total_clicked: number; total_bounced: number; sent_at: string }[]>([])
  const [totals, setTotals] = useState({ sent: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0 })

  useEffect(() => {
    ;(async () => {
      const ago = new Date(Date.now() - range * 86400000).toISOString()
      const { data: events } = await supabase.from('email_events').select('event_type,occurred_at').gte('occurred_at', ago)
      const { data: cList } = await supabase.from('campaigns').select('id,name,total_sent,total_opened,total_clicked,total_bounced,total_complained,total_unsubscribed,sent_at').in('status', ['sent', 'sending']).order('sent_at', { ascending: false }).limit(20)

      const dayMap: Record<string, { sent: number; opened: number; clicked: number; bounced: number }> = {}
      for (let i = range - 1; i >= 0; i--) {
        const k = new Date(Date.now() - i * 86400000).toISOString().slice(5, 10)
        dayMap[k] = { sent: 0, opened: 0, clicked: 0, bounced: 0 }
      }
      ;(events ?? []).forEach((e: { event_type: string; occurred_at: string }) => {
        const k = new Date(e.occurred_at).toISOString().slice(5, 10)
        if (!dayMap[k]) return
        if (e.event_type === 'sent') dayMap[k].sent++
        if (e.event_type === 'opened') dayMap[k].opened++
        if (e.event_type === 'clicked') dayMap[k].clicked++
        if (e.event_type === 'bounced') dayMap[k].bounced++
      })
      setSeries(Object.entries(dayMap).map(([day, v]) => ({ day, ...v })))
      setCampaigns(cList ?? [])

      const t = (cList ?? []).reduce((a, c) => ({
        sent: a.sent + (c.total_sent || 0), opened: a.opened + (c.total_opened || 0),
        clicked: a.clicked + (c.total_clicked || 0), bounced: a.bounced + (c.total_bounced || 0),
        complained: a.complained + ((c as any).total_complained || 0), unsubscribed: a.unsubscribed + ((c as any).total_unsubscribed || 0),
      }), { sent: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0 })
      setTotals(t)
    })()
  }, [range])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Analytics</div>
          <div className="page-sub">Campaign performance overview</div>
        </div>
        <select value={range} onChange={e => setRange(Number(e.target.value))} style={{ width: 160 }}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { l: 'Emails sent', v: fmt(totals.sent), sub: 'Total' },
          { l: 'Avg open rate', v: `${pct(totals.opened, totals.sent)}%`, sub: `Target >20%`, alert: pct(totals.opened, totals.sent) < 20 && totals.sent > 0 },
          { l: 'Avg click rate', v: `${pct(totals.clicked, totals.sent)}%`, sub: 'Target >2%' },
          { l: 'Bounce rate', v: `${pct(totals.bounced, totals.sent)}%`, sub: 'Keep below 2%', alert: pct(totals.bounced, totals.sent) >= 2 },
          { l: 'Complaint rate', v: `${pct(totals.complained, totals.sent)}%`, sub: 'Keep below 0.1%', alert: pct(totals.complained, totals.sent) >= 0.1 },
          { l: 'Unsubscribe rate', v: `${pct(totals.unsubscribed, totals.sent)}%`, sub: 'Keep below 0.5%' },
        ].map(s => (
          <div key={s.l} className="stat-card" style={(s as any).alert ? { borderColor: 'var(--red)', background: 'rgba(239,68,68,0.05)' } : {}}>
            <div className="stat-label" style={(s as any).alert ? { color: 'var(--red)' } : {}}>{s.l}</div>
            <div className="stat-value" style={(s as any).alert ? { color: 'var(--red)', fontSize: 22 } : { fontSize: 22 }}>{s.v}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 16 }}>Email events over time</div>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" stroke="var(--text2)" fontSize={11} />
              <YAxis stroke="var(--text2)" fontSize={11} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="sent" stroke="#6366f1" strokeWidth={2} dot={false} name="Sent" />
              <Line type="monotone" dataKey="opened" stroke="#22c55e" strokeWidth={2} dot={false} name="Opened" />
              <Line type="monotone" dataKey="clicked" stroke="#3b82f6" strokeWidth={2} dot={false} name="Clicked" />
              <Line type="monotone" dataKey="bounced" stroke="#ef4444" strokeWidth={2} dot={false} name="Bounced" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 16 }}>Open rate by campaign</div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={campaigns.slice(0, 8).map(c => ({ name: c.name.slice(0, 20), openRate: pct(c.total_opened, c.total_sent) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text2)" fontSize={10} />
              <YAxis stroke="var(--text2)" fontSize={11} unit="%" />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} formatter={(v: number) => [`${v}%`, 'Open rate']} />
              <Bar dataKey="openRate" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Open rate" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Campaign performance</div>
        <table>
          <thead>
            <tr>
              <th>Campaign</th><th style={{ textAlign: 'right' }}>Sent</th><th style={{ textAlign: 'right' }}>Open rate</th><th style={{ textAlign: 'right' }}>Click rate</th><th style={{ textAlign: 'right' }}>Bounce rate</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>{c.name}</td>
                <td style={{ textAlign: 'right' }}>{fmt(c.total_sent)}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: pct(c.total_opened, c.total_sent) >= 20 ? 'var(--green)' : 'var(--text)' }}>{pct(c.total_opened, c.total_sent)}%</td>
                <td style={{ textAlign: 'right' }}>{pct(c.total_clicked, c.total_sent)}%</td>
                <td style={{ textAlign: 'right', color: pct(c.total_bounced, c.total_sent) >= 2 ? 'var(--red)' : 'var(--text2)' }}>{pct(c.total_bounced, c.total_sent)}%</td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{c.sent_at ? new Date(c.sent_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
            {!campaigns.length && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text2)' }}>No sent campaigns yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
