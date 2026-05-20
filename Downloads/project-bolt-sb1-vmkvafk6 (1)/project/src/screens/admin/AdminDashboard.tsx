import { useState } from 'react';
import { Home, Search, Users, Clock, User } from 'lucide-react';
import AdminHomeScreen from './AdminHomeScreen';
import AdminSearchScreen from './AdminSearchScreen';
import AdminUsersScreen from './AdminUsersScreen';
import AdminHistoryScreen from './AdminHistoryScreen';
import AdminMyScreen from './AdminMyScreen';

type Tab = 'home' | 'search' | 'users' | 'history' | 'my';

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('home');

  return (
    <div className="flex flex-col h-screen bg-[#111111]">
      <div className="flex-1 overflow-hidden">
        {tab === 'home' && <AdminHomeScreen />}
        {tab === 'search' && <AdminSearchScreen />}
        {tab === 'users' && <AdminUsersScreen />}
        {tab === 'history' && <AdminHistoryScreen />}
        {tab === 'my' && <AdminMyScreen />}
      </div>

      <nav className="bg-[#111111] border-t border-white/[0.06] flex items-center px-1 pb-2 pt-2" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999 }}>
        {([
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'search', icon: Search, label: 'Search' },
          { id: 'users', icon: Users, label: 'Users' },
          { id: 'history', icon: Clock, label: 'History' },
          { id: 'my', icon: User, label: 'My' },
        ] as { id: Tab; icon: React.ElementType; label: string }[]).map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className="flex-1 flex flex-col items-center gap-0.5 py-1 active:opacity-70 transition-opacity"
          >
            <item.icon
              size={22}
              className={`transition-colors ${tab === item.id ? 'text-yellow-400' : 'text-gray-600'}`}
              strokeWidth={tab === item.id ? 2.5 : 1.8}
            />
            <span className={`text-[10px] font-bold transition-colors ${tab === item.id ? 'text-yellow-400' : 'text-gray-600'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
