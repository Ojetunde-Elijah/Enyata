import React from 'react';
import { Bell, Settings as SettingsIcon, Search } from 'lucide-react';

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  return (
    <header className="w-full sticky top-0 z-40 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md shadow-sm dark:shadow-none flex justify-between items-center px-12 py-4">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-black tracking-tight text-blue-900 dark:text-blue-200">{title}</h2>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex gap-4">
          <button className="text-slate-500 hover:bg-slate-200/50 p-2 rounded-full transition-colors active:scale-95">
            <Bell className="w-5 h-5" />
          </button>
          <button className="text-slate-500 hover:bg-slate-200/50 p-2 rounded-full transition-colors active:scale-95">
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3 border-l border-slate-200 pl-6 h-8">
          <div className="text-right">
            <p className="text-sm font-bold text-on-surface">Alex Thompson</p>
            <p className="text-[10px] text-slate-500 font-medium">Administrator</p>
          </div>
          <img 
            alt="User profile avatar" 
            className="w-10 h-10 rounded-full border-2 border-primary-container/20 object-cover" 
            src="https://picsum.photos/seed/alex/100/100"
          />
        </div>
      </div>
    </header>
  );
}
