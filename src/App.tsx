import React, { useState, useEffect } from 'react';
import { seedDatabase } from './db';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Billing } from './components/Billing';
import { Inventory } from './components/Inventory';
import { Ledger } from './components/Ledger';
import { Purchases } from './components/Purchases';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  BookOpen, 
  Truck, 
  BarChart2, 
  Settings as SettingsIcon, 
  LogOut, 
  Terminal
} from 'lucide-react';

interface Toast {
  id: number;
  msg: string;
  type: 'success' | 'warning' | 'danger';
}

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [activeScreen, setActiveScreen] = useState<string>('dashboard');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Seed DB on mount
  useEffect(() => {
    seedDatabase();
  }, []);

  // Quick helper for Toast Notifications
  const addToast = (msg: string, type: 'success' | 'warning' | 'danger' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    
    // Auto remove after 3.5s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  const handleLogin = (role: string, name: string) => {
    setCurrentUser(name);
    setUserRole(role);
    
    // Direct staff to matching screens upon login for speed
    if (role === 'Inventory Staff') {
      setActiveScreen('inventory');
    } else if (role === 'Accountant') {
      setActiveScreen('reports');
    } else {
      setActiveScreen('dashboard');
    }

    addToast(`Welcome back, ${name}! Logged in as ${role}.`, 'success');
  };

  const handleLogout = () => {
    addToast(`${currentUser} logged out.`, 'warning');
    setCurrentUser('');
    setUserRole('');
    setActiveScreen('dashboard');
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  // Sidebar Links based on Roles
  const navItems = [
    { id: 'dashboard', label: 'Command Center', icon: <LayoutDashboard size={20} />, allowed: ['Owner', 'Admin', 'Cashier', 'Accountant'] },
    { id: 'billing', label: 'Billing Desk', icon: <ShoppingCart size={20} />, allowed: ['Owner', 'Admin', 'Cashier'] },
    { id: 'inventory', label: 'Physical Stock', icon: <Package size={20} />, allowed: ['Owner', 'Admin', 'Inventory Staff'] },
    { id: 'ledger', label: 'Credit Ledger', icon: <BookOpen size={20} />, allowed: ['Owner', 'Admin', 'Accountant'] },
    { id: 'purchases', label: 'Supply Chain', icon: <Truck size={20} />, allowed: ['Owner', 'Admin', 'Inventory Staff'] },
    { id: 'reports', label: 'Reports & P&L', icon: <BarChart2 size={20} />, allowed: ['Owner', 'Admin', 'Accountant'] },
    { id: 'settings', label: 'System Settings', icon: <SettingsIcon size={20} />, allowed: ['Owner', 'Admin', 'Accountant'] },
  ];

  const currentNavItems = navItems.filter(item => item.allowed.includes(userRole));

  return (
    <div className="app-container">
      
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          {/* Brand header */}
          <div className="brand-section">
            <div className="brand-logo">
              <Terminal size={20} />
            </div>
            <div>
              <h2 className="brand-name">Smart POS</h2>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Terminal #01</span>
            </div>
          </div>

          {/* Navigation Links */}
          <ul className="nav-links">
            {currentNavItems.map(item => (
              <li key={item.id}>
                <a
                  className={`nav-item ${activeScreen === item.id ? 'active' : ''}`}
                  onClick={() => setActiveScreen(item.id)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* User Info Details / Log Out */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="user-profile">
            <div className="user-avatar">
              {currentUser.charAt(0)}
            </div>
            <div className="user-info">
              <span className="user-name">{currentUser.split(' ')[0]}</span>
              <span className="user-role">{userRole}</span>
            </div>
          </div>

          <button className="btn btn-secondary" style={{ width: '100%', gap: '8px', padding: '10px' }} onClick={handleLogout}>
            <LogOut size={16} />
            Exit Terminal
          </button>
        </div>
      </aside>

      {/* Screen Render Viewport */}
      <main style={{ flexGrow: 1, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeScreen === 'dashboard' && <Dashboard currentUser={currentUser} userRole={userRole} onNavigate={setActiveScreen} />}
        {activeScreen === 'billing' && <Billing currentUser={currentUser} userRole={userRole} addToast={addToast} />}
        {activeScreen === 'inventory' && <Inventory currentUser={currentUser} userRole={userRole} addToast={addToast} />}
        {activeScreen === 'ledger' && <Ledger currentUser={currentUser} userRole={userRole} addToast={addToast} />}
        {activeScreen === 'purchases' && <Purchases currentUser={currentUser} userRole={userRole} addToast={addToast} />}
        {activeScreen === 'reports' && <Reports currentUser={currentUser} userRole={userRole} addToast={addToast} />}
        {activeScreen === 'settings' && <Settings currentUser={currentUser} userRole={userRole} addToast={addToast} />}
      </main>

      {/* Slide-in Toast Notifications drawer */}
      <div className="toast-container">
        {toasts.map(t => {
          let borderCol = 'var(--color-primary)';
          if (t.type === 'warning') borderCol = 'var(--color-warning)';
          if (t.type === 'danger') borderCol = 'var(--color-danger)';

          return (
            <div key={t.id} className="toast" style={{ borderLeftColor: borderCol }}>
              {t.msg}
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default App;
