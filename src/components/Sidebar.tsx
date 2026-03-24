import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { clearToken } from '../api/client';
import { 
  LayoutDashboard, 
  ReceiptText, 
  Package, 
  BarChart3, 
  Settings, 
  HelpCircle, 
  LogOut,
  Wallet,
  PlusCircle
} from 'lucide-react';
import { cn } from '../utils/cn';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: ReceiptText, label: 'Invoices', path: '/invoices' },
  { icon: Package, label: 'Inventory', path: '/inventory' },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  function logout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 overflow-y-auto bg-slate-100 dark:bg-slate-900 border-r border-slate-200/50 dark:border-slate-800/50 flex flex-col gap-2 p-4 z-50">
      <div className="mb-8 px-2 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center">
          <Wallet className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-blue-900 dark:text-blue-100 leading-none">Kolet Pay</h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">Enterprise Port</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 transition-all hover:translate-x-1 duration-200 text-sm font-medium tracking-wide rounded-lg",
              isActive 
                ? "bg-white dark:bg-slate-800 text-blue-800 dark:text-blue-300 shadow-sm" 
                : "text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-white/50 dark:hover:bg-slate-800/50"
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-slate-200/50 dark:border-slate-800/50 space-y-1">
        <button className="w-full bg-gradient-to-br from-primary to-primary-container text-white py-2.5 rounded-lg text-sm font-semibold shadow-md active:scale-95 transition-all mb-4 flex items-center justify-center gap-2">
          <PlusCircle className="w-4 h-4" />
          New Transaction
        </button>
        
        <NavLink
          to="/help"
          className="flex items-center gap-3 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all text-sm font-medium rounded-lg"
        >
          <HelpCircle className="w-5 h-5" />
          Help Center
        </NavLink>
        
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 text-error hover:bg-error-container/10 transition-all text-sm font-medium rounded-lg"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
