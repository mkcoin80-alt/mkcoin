import { useState } from 'react';
import { Home, Users, History, Settings, User } from 'lucide-react';
import SAHomeScreen from './SAHomeScreen';
import SAUsersScreen from './SAUsersScreen';
import SAPaymentsScreen from './SAPaymentsScreen';
import SASettingsScreen from './SASettingsScreen';
import SAMyScreen from './SAMyScreen';

type Tab = 'home' | 'users' | 'payments' | 'settings' | 'my';

export default function SuperAdminDashboard() {
  const [tab, setTab] = useState<Tab>('home');

  return (
    <div className="flex flex-col h-screen bg-[#111111]">
      <div className="flex-1 overflow-hidden">
        {tab === 'home' && <SAHomeScreen />}
        {tab === 'users' && <SAUsersScreen />}
        {tab === 'payments' && <SAPaymentsScreen />}
        {tab === 'settings' && <SASettingsScreen />}
        {tab === 'my' && <SAMyScreen />}
      </div>

      <nav className="bg-[#111111] border-t border-white/[0.06] flex items-center px-1 pb-2 pt-2 shrink-0">
        {([
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'users', icon: Users, label: 'Users' },
          { id: 'payments', icon: History, label: 'Payments' },
          { id: 'settings', icon: Settings, label: 'Settings' },
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
