import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { LayoutDashboard, Users, FileText, Send, BarChart2, ShieldOff, Settings, LogOut, Mail, Network } from 'lucide-react'

export default function Layout() {
  const { user, roles, signOut } = useAuth()
  const nav = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    nav('/login')
  }

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/contacts', icon: Users, label: 'Contacts' },
    { to: '/contacts/segments', icon: Network, label: 'Segments' },
    { to: '/templates', icon: FileText, label: 'Templates' },
    { to: '/campaigns', icon: Send, label: 'Campaigns' },
    { to: '/analytics', icon: BarChart2, label: 'Analytics' },
    { to: '/suppressions', icon: ShieldOff, label: 'Suppressions' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <div style={{ display: 'flex' }}>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Mail size={20} color="var(--primary)" />
          Postmark
        </div>
        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
          {roles.length > 0 && (
            <div style={{ fontSize: 11, marginBottom: 10 }}>
              <span className="badge badge-scheduled">{roles[0].replace('_', ' ')}</span>
            </div>
          )}
          <button className="btn-ghost" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }} onClick={handleSignOut}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
