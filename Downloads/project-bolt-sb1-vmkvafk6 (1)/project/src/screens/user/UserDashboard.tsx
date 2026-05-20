import { useState } from 'react';
import { Home, CreditCard, Plus, Clock, User } from 'lucide-react';
import HomeScreen from './HomeScreen';
import AccountScreen from './AccountScreen';
import AddBankScreen from './AddBankScreen';
import HistoryScreen from './HistoryScreen';
import MyScreen from './MyScreen';

type Tab = 'home' | 'account' | 'history' | 'my';

export default function UserDashboard() {
  const [tab, setTab] = useState<Tab>('home');
  const [showAdd, setShowAdd] = useState(false);
  const [accountRefresh, setAccountRefresh] = useState(0);
  const [myInitialView, setMyInitialView] = useState<'menu' | 'notifications'>('menu');

  const handleAddDone = () => {
    setShowAdd(false);
    setTab('account');
    setAccountRefresh(k => k + 1);
  };

  const handleNotifPress = () => {
    setMyInitialView('notifications');
    setTab('my');
  };

  if (showAdd) {
    return <AddBankScreen onBack={() => setShowAdd(false)} onAdded={handleAddDone} />;
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex-1 overflow-hidden">
        {tab === 'home' && (
          <HomeScreen onNotifPress={handleNotifPress} />
        )}
        {tab === 'account' && <AccountScreen key={accountRefresh} />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'my' && (
          <MyScreen
            initialView={myInitialView}
            onViewChange={() => setMyInitialView('menu')}
          />
        )}
      </div>

      <nav className="bg-white border-t border-gray-100 flex items-end px-1 pb-2 pt-2" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999 }}>
        <NavBtn icon={Home} label="Home" active={tab === 'home'} onClick={() => setTab('home')} />
        <NavBtn icon={CreditCard} label="Account" active={tab === 'account'} onClick={() => setTab('account')} />

        {/* Centre FAB */}
        <button
          onClick={() => setShowAdd(true)}
          className="flex-1 flex flex-col items-center"
          aria-label="Add Bank Account"
        >
          <div className="w-[54px] h-[54px] bg-yellow-400 rounded-full flex items-center justify-center shadow-lg shadow-yellow-300/60 -mt-6 border-[3px] border-white active:scale-90 transition-transform">
            <Plus size={24} className="text-gray-900 stroke-[2.5]" />
          </div>
          <span className="text-[10px] font-bold text-yellow-500 mt-0.5 leading-none">Add</span>
        </button>

        <NavBtn icon={Clock} label="History" active={tab === 'history'} onClick={() => setTab('history')} />
        <NavBtn icon={User} label="My" active={tab === 'my'} onClick={() => { setMyInitialView('menu'); setTab('my'); }} />
      </nav>
    </div>
  );
}

function NavBtn({ icon: Icon, label, active, onClick }: {
  icon: React.ElementType; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center gap-0.5 py-1 active:opacity-70 transition-opacity">
      <Icon
        size={22}
        className={`transition-colors ${active ? 'text-yellow-500' : 'text-gray-400'}`}
        strokeWidth={active ? 2.5 : 1.8}
      />
      <span className={`text-[10px] font-bold transition-colors ${active ? 'text-yellow-500' : 'text-gray-400'}`}>
        {label}
      </span>
    </button>
  );
}
