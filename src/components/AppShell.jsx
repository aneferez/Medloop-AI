import {
  Bell,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  FileText,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Pill,
  Settings,
  ShieldPlus,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Avatar, IconButton, Tooltip } from '@mui/material'
import { pages } from '../navigation'

const navigationIcons = {
  home: Home,
  dashboard: LayoutDashboard,
  family: Users,
  medicines: Pill,
  prescriptions: FileText,
  alerts: Bell,
  appointments: CalendarDays,
  reports: ChartNoAxesColumnIncreasing,
  'emergency-card': ShieldPlus,
  settings: Settings,
  legal: ShieldCheck,
}

function AppShell({ currentPage, pageTitle, syncLabel, user, profilePhotoUrl, navigateTo, handleLogout, children }) {
  const [navigationOpen, setNavigationOpen] = useState(false)

  useEffect(() => {
    setNavigationOpen(false)
  }, [currentPage])

  useEffect(() => {
    if (!navigationOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setNavigationOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [navigationOpen])

  const navigateAndClose = (pageId) => {
    setNavigationOpen(false)
    navigateTo(pageId)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${navigationOpen ? 'open' : ''}`} id="primary-navigation">
        <div className="sidebar-header">
          <button className="brand" onClick={() => navigateAndClose('home')} type="button" aria-label="Open MedLoop home">
            <img src="/medloop-logo-192.png" alt="" />
            <span><strong>MedLoop</strong><small>Care coordination</small></span>
          </button>
          <button className="menu-close" onClick={() => setNavigationOpen(false)} type="button" aria-label="Close navigation">
            <X size={22} />
          </button>
        </div>

        <nav className="nav-links" aria-label="Primary navigation">
          {pages.map((page) => {
            const Icon = navigationIcons[page.id]
            return (
              <button
                className={currentPage === page.id ? 'active' : ''}
                key={page.id}
                onClick={() => navigateAndClose(page.id)}
                type="button"
              >
                <Icon size={18} />
                <span>{page.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-status">
          <span className={`status-dot ${user ? 'online' : ''}`} />
          <div><strong>Local account</strong><small>{user?.email || 'Sign in on this device'}</small></div>
        </div>
      </aside>

      {navigationOpen ? (
        <button
          aria-label="Close navigation"
          className="navigation-backdrop"
          onClick={() => setNavigationOpen(false)}
          type="button"
        />
      ) : null}

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-title">
            <button
              aria-controls="primary-navigation"
              aria-expanded={navigationOpen}
              aria-label="Open navigation"
              className="menu-toggle"
              onClick={() => setNavigationOpen(true)}
              type="button"
            >
              <Menu size={22} />
            </button>
            <div>
              <p className="eyebrow">Daily health coordination</p>
              <h1>{pageTitle}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <Tooltip title="Profile settings">
              <IconButton aria-label="Open profile settings" onClick={() => navigateTo('settings')} size="small">
                <Avatar alt={user?.displayName || user?.email || 'MedLoop profile'} src={profilePhotoUrl} sx={{ width: 38, height: 38, bgcolor: 'primary.main', fontSize: '0.9rem', fontWeight: 800 }}>
                  {(user?.displayName || user?.email || 'M').slice(0, 1).toUpperCase()}
                </Avatar>
              </IconButton>
            </Tooltip>
            <span className="sync-label">{syncLabel}</span>
            {user ? (
              <button className="secondary-btn" onClick={handleLogout} type="button"><LogOut size={16} /> Log out</button>
            ) : (
              <button className="primary-btn" onClick={() => navigateTo('auth')} type="button"><LogIn size={16} /> Sign in</button>
            )}
          </div>
        </header>

        <div className="page-content">{children}</div>
      </main>
    </div>
  )
}

export default AppShell
