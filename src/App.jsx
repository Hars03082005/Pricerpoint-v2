import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { AppProvider, useApp }   from './context/AppContext.jsx';
import Icon          from './components/Icon.jsx';
import AuthScreen    from './screens/AuthScreen.jsx';
import HomeScreen     from './screens/HomeScreen.jsx';
import InputScreen    from './screens/InputScreen.jsx';
import ResultScreen   from './screens/ResultScreen.jsx';
import ExplainScreen  from './screens/ExplainScreen.jsx';
import PricingScreen  from './screens/PricingScreen.jsx';
import DashboardScreen from './screens/DashboardScreen.jsx';
import AssistantScreen from './screens/AssistantScreen.jsx';
import EnhancedValuationScreen from './screens/EnhancedValuationScreen.jsx';
import EnhancedResultScreen from './screens/EnhancedResultScreen.jsx';
import ReverseCalculatorScreen from './screens/ReverseCalculatorScreen.jsx';
import './App.css';

const NAV_SECTIONS = [
  {
    title: 'Main',
    items: [
      { id: 'home',           label: 'Home',                icon: 'home'           },
      { id: 'input',          label: 'Valuation',           icon: 'car'            },
      { id: 'enhanced-input', label: 'Enhanced Valuation',  icon: 'zap'            },
      { id: 'reverse-calc',   label: 'Reverse Calculator',  icon: 'arrowLeftRight' },
    ],
  },
  {
    title: 'Results',
    items: [
      { id: 'result',          label: 'Result',           icon: 'bulb'  },
      { id: 'enhanced-result', label: 'Enhanced Result',  icon: 'zap'   },
      { id: 'explain',         label: 'AI Report',        icon: 'brain' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { id: 'pricing',   label: 'Pricing',   icon: 'coins' },
      { id: 'dashboard', label: 'Analytics', icon: 'chart' },
      { id: 'assistant', label: 'Assistant', icon: 'brain' },
    ],
  },
];

const NAV_TABS = NAV_SECTIONS.flatMap(section => section.items);

const ROLE_COLORS = { Dealer: '#f75d34' };

// ── User Avatar Button + Dropdown ─────────────────────────
function UserMenu() {
  const { currentUser, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (!currentUser) return null;

  const roleColor = ROLE_COLORS[currentUser.role] || '#f75d34';

  return (
    <div className="user-menu-wrap">
      <button
        className="user-avatar-btn"
        onClick={() => setOpen(o => !o)}
        style={{ '--role-color': roleColor }}
      >
        <span className="user-avatar" style={{ background: roleColor }}>
          {currentUser.avatar}
        </span>
      </button>

      {open && (
        <>
          <div className="user-menu-backdrop" onClick={() => setOpen(false)} />
          <div className="user-menu-dropdown">
            <div className="user-menu-profile">
              <div className="user-menu-avatar" style={{ background: roleColor }}>
                {currentUser.avatar}
              </div>
              <div className="user-menu-info">
                <div className="user-menu-name">{currentUser.name}</div>
                <div className="user-menu-email">{currentUser.email}</div>
                <div className="user-menu-role" style={{ color: roleColor }}>
                  <Icon
                    name="store"
                    size={11} color={roleColor} strokeWidth={2}
                  />
                  Dealer / Seller
                </div>
              </div>
            </div>
            <div className="user-menu-divider" />
            <button className="user-menu-item" onClick={() => { setOpen(false); logout(); }}>
              <Icon name="arrowLeft" size={15} color="#e02020" strokeWidth={2} />
              <span style={{ color: '#e02020' }}>Sign Out</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main App Shell (authenticated) ────────────────────────
function AppShell() {
  const { activeScreen, setActiveScreen } = useApp();
  useAuth();

  const SCREENS = {
    home:      <HomeScreen />,
    input:     <InputScreen />,
    'enhanced-input': <EnhancedValuationScreen />,
    'enhanced-result': <EnhancedResultScreen />,
    'reverse-calc': <ReverseCalculatorScreen />,
    result:    <ResultScreen />,
    explain:   <ExplainScreen />,
    pricing:   <PricingScreen />,
    dashboard: <DashboardScreen />,
    assistant: <AssistantScreen />,
  };

  const isActiveNav = (id) => activeScreen === id;

  return (
    <div className="app-root">
      {/* ── Desktop sidebar ── */}
      <aside className="app-sidebar">
        <nav className="sidebar-nav">
          {NAV_SECTIONS.map(section => (
            <div key={section.title} className="sidebar-section">
              <div className="sidebar-section-label">{section.title}</div>
              {section.items.map(tab => (
                <button
                  key={tab.id}
                  className={`sidebar-nav-btn ${isActiveNav(tab.id) ? 'active' : ''}`}
                  onClick={() => setActiveScreen(tab.id)}
                >
                  <Icon
                    name={tab.icon}
                    size={18}
                    color={isActiveNav(tab.id) ? '#f75d34' : '#888'}
                    strokeWidth={isActiveNav(tab.id) ? 2.2 : 1.6}
                  />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="app-body">
        {/* ── Header ── */}
        <header className="app-header">
          <div className="header-brand">
            <div className="header-logo-wrap">
              <Icon name="car" size={22} color="#f75d34" strokeWidth={2} />
            </div>
            <div>
              <div className="header-name">Pricer<span className="header-ai">Point</span></div>
              <div className="header-tagline">Dealer Decision Engine</div>
            </div>
          </div>
          <div className="header-search">
            <Icon name="search" size={16} color="#aaa" strokeWidth={2} />
            <input type="text" placeholder="Search vehicles, VINs, evaluations…" readOnly aria-label="Search" />
          </div>
          <UserMenu />
        </header>

        {/* ── Mobile top nav ── */}
        <nav className="top-nav">
          {NAV_TABS.map(tab => (
            <button
              key={tab.id}
              className={`top-nav-btn ${isActiveNav(tab.id) ? 'active' : ''}`}
              onClick={() => setActiveScreen(tab.id)}
            >
              <Icon
                name={tab.icon}
                size={18}
                color={isActiveNav(tab.id) ? '#f75d34' : '#aaa'}
                strokeWidth={isActiveNav(tab.id) ? 2.2 : 1.6}
              />
              <span className="tnav-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* ── Content ── */}
        <main className="app-main">
          <div className="screen-wrapper" key={activeScreen}>
            {SCREENS[activeScreen]}
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Root: Auth gate ────────────────────────────────────────
function Root() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="splash-screen">
        <div className="splash-logo">
          <Icon name="car" size={40} color="#f75d34" strokeWidth={1.8} />
        </div>
        <div className="splash-name">Pricer<span style={{ color:'#f75d34', fontStyle:'italic' }}>Point</span></div>
        <div className="splash-dots">
          <span /><span /><span />
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="app-root">
        <AuthScreen />
      </div>
    );
  }

  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
