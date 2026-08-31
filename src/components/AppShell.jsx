import {
  Bell,
  Bot,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  FileText,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Pill,
  Settings,
  Sun,
  ShieldPlus,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Avatar, IconButton, Tooltip } from '@mui/material'
import { pages } from '../navigation'
import { currentTheme, toggleTheme } from '../lib/theme'
import SectionAssistant from './SectionAssistant'

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

const dashboardNavigation = [
  { id: 'dashboard', label: 'Today' },
  { id: 'medicines', label: 'Medications' },
  { id: 'family', label: 'Care Circle' },
  { id: 'prescriptions', label: 'Prescriptions' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'settings', label: 'Settings' },
]

function formatShellDate() {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())
}

function getConnectedCaregiver(familyMembers) {
  return (familyMembers || []).find((member) => member?.alertLevel === 'Level 1')
    || (familyMembers || []).find((member) => member?.alertLevel === 'Level 2')
    || null
}

function AppShell({ currentPage, pageTitle, syncLabel, user, profilePhotoUrl, navigateTo, handleLogout, assistantContext, familyMembers = [], alertCount = 0, children }) {
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [theme, setTheme] = useState(() => currentTheme())
  const caregiver = getConnectedCaregiver(familyMembers)
  const navigationPages = currentPage === 'dashboard' ? dashboardNavigation : pages

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
    <div className={`app-shell ${currentPage === 'dashboard' ? 'ritual-shell' : ''}`}>
      <aside className={`sidebar ${navigationOpen ? 'open' : ''}`} id="primary-navigation">
        <div className="sidebar-header">
          <button className="brand" onClick={() => navigateAndClose('home')} type="button" aria-label="Open MedLoop home">
            <img src="/medloop-logo-192.png" alt="" />
            <span><strong>MedLoop <em>AI</em></strong><small>Medication command center</small></span>
          </button>
          <button className="menu-close" onClick={() => setNavigationOpen(false)} type="button" aria-label="Close navigation">
            <X size={22} />
          </button>
        </div>

        <nav className="nav-links" aria-label="Primary navigation">
          {navigationPages.map((page) => {
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

        {currentPage === 'dashboard' ? (
          <section className="sidebar-care-card" aria-label="Caregiver connection">
            <div className="sidebar-care-heading"><span>{caregiver ? 'Caregiver connected' : 'Care circle'}</span><i className={caregiver ? 'connected' : ''} /></div>
            {caregiver ? (
              <div className="sidebar-care-person"><span>{String(caregiver.name || 'C').slice(0, 1).toUpperCase()}</span><div><strong>{caregiver.name}</strong><small>{caregiver.relationship || caregiver.alertLevel || 'Family member'}</small></div></div>
            ) : <p>Add a trusted caregiver to share selected care signals.</p>}
            <button onClick={() => navigateAndClose('family')} type="button"><MessageCircle size={17} /> {caregiver ? 'Manage care circle' : 'Connect caregiver'} <span aria-hidden="true">›</span></button>
          </section>
        ) : null}

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
          {currentPage === 'dashboard' ? <div className="ritual-topbar-date"><span>Today is</span><strong>{formatShellDate()}</strong></div> : null}
          <div className="topbar-actions">
            {currentPage === 'dashboard' ? <button className="ritual-alert-button" onClick={() => navigateTo('alerts')} type="button" aria-label={alertCount ? `${alertCount} open alerts` : 'Open care updates'}><Bell size={20} /><span className="ritual-alert-copy">{alertCount ? `You have ${alertCount} new update${alertCount === 1 ? '' : 's'}` : 'View care updates'}</span>{alertCount ? <span aria-hidden="true" className="ritual-alert-count">{Math.min(alertCount, 9)}</span> : null}<ChevronRight aria-hidden="true" size={18} /></button> : null}
            {currentPage === 'dashboard' ? <button className="ritual-ai-button" onClick={() => window.dispatchEvent(new Event('medloop:open-assistant'))} type="button" aria-label="Open MedLoop AI guide"><Bot size={18} /><span>AI guide</span></button> : null}
            <Tooltip title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <button className="theme-toggle" onClick={() => setTheme(toggleTheme())} type="button" aria-label="Toggle dark mode">
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </Tooltip>
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

        <div className={`page-content ${currentPage !== 'dashboard' ? 'with-section-assistant' : ''}`}>{children}</div>
        <footer className="app-footer">Developed by Aneruth <span aria-hidden="true">|</span> Rosaline</footer>
      </main>
      <SectionAssistant context={assistantContext} currentPage={currentPage} navigateTo={navigateTo} user={user} />
    </div>
  )
}

export default AppShell
