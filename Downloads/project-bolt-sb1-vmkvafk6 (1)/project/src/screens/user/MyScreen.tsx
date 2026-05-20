import { useEffect, useState } from 'react';
import {
  Wallet, Bell, Info, LogOut, ChevronRight, User,
  Shield, Calendar, Phone, Key, ArrowLeft, IndianRupee,
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

interface UserDetails {
  name: string;
  user_id: string;
  password: string;
  phone: string;
  created_at: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

type View = 'menu' | 'profile' | 'wallet' | 'notifications' | 'about';

interface Props {
  initialView?: View;
  onViewChange?: () => void;
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="bg-yellow-400 px-5 pt-5 pb-4 flex items-center gap-3 shrink-0">
      <button onClick={onBack} className="w-9 h-9 bg-yellow-300 rounded-xl flex items-center justify-center active:scale-95 transition-transform">
        <ArrowLeft size={18} className="text-gray-900" />
      </button>
      <h1 className="text-xl font-black text-gray-900">{title}</h1>
    </div>
  );
}

export default function MyScreen({ initialView = 'menu', onViewChange }: Props) {
  const { user, logout } = useAuth();
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [view, setView] = useState<View>(initialView);

  useEffect(() => { setView(initialView); }, [initialView]);

  useEffect(() => {
    loadUser();
    loadEarnings();
    loadNotifications();
  }, []);

  const handleBack = () => {
    setView('menu');
    onViewChange?.();
  };

  const loadUser = async () => {
    const snap = await getDoc(doc(db, 'users', user!.id));
    if (snap.exists()) {
      const data = snap.data();
      setUserDetails({
        name: data.name,
        user_id: data.user_id,
        password: data.password,
        phone: data.phone || '',
        created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
      });
    }
  };

  const loadEarnings = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const snap = await getDocs(query(collection(db, 'transactions'), where('user_id', '==', user!.id)));
      const data = snap.docs.map(d => d.data());
      setTotalEarnings(data.reduce((s, t) => s + Number(t.earning || 0), 0));
      setTodayEarnings(
        data.filter(t => (t.created_at?.toDate?.() || new Date()) >= today)
          .reduce((s, t) => s + Number(t.earning || 0), 0)
      );
    } catch (e) {
      console.error('Error loading earnings:', e);
    }
  };

  const loadNotifications = async () => {
    try {
      const snap = await getDocs(collection(db, 'notifications'));
      const notifs = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title,
          message: data.message,
          created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        };
      });
      notifs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifications(notifs);
    } catch (e) {
      console.error('Error loading notifications:', e);
    }
  };

  const fmt = (n: number) =>
    `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (view === 'profile') {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        <SubHeader title="My Profile" onBack={handleBack} />
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50 mb-4">
            {([
              { icon: User, label: 'Full Name', value: userDetails?.name },
              { icon: Shield, label: 'User ID', value: userDetails?.user_id },
              { icon: Key, label: 'Password', value: userDetails?.password },
              { icon: Phone, label: 'Phone Number', value: userDetails?.phone || 'Not set' },
              {
                icon: Calendar, label: 'Joined Date',
                value: userDetails?.created_at
                  ? new Date(userDetails.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
                  : '—',
              },
            ] as { icon: React.ElementType; label: string; value?: string }[]).map(({ icon: Icon, label, value }, i) => (
              <div key={label} className={`flex items-center gap-4 px-5 py-4 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-yellow-600" strokeWidth={1.8} />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] text-gray-400 font-medium">{label}</p>
                  <p className="font-bold text-gray-900 mt-0.5">{value || '—'}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 text-center">
            <p className="text-xs text-amber-700">Profile is <strong>read-only</strong>. Contact your admin to make changes.</p>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'wallet') {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        <SubHeader title="My Wallet" onBack={handleBack} />
        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
          <div className="bg-gradient-to-br from-yellow-400 to-amber-500 rounded-3xl p-5 shadow-lg shadow-yellow-200/50">
            <div className="flex items-center gap-2 mb-1">
              <IndianRupee size={14} className="text-yellow-800" strokeWidth={2.5} />
              <p className="text-yellow-800 text-sm font-medium">Total Balance</p>
            </div>
            <p className="text-4xl font-black text-gray-900">{fmt(totalEarnings)}</p>
            <div className="mt-4 pt-3 border-t border-yellow-300/50 flex justify-between text-sm">
              <span className="text-yellow-800">Today's Profit</span>
              <span className="font-black text-gray-900">{fmt(todayEarnings)}</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
            <div className="flex justify-between items-center px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
                  <IndianRupee size={14} className="text-green-600" strokeWidth={2} />
                </div>
                <span className="text-gray-700 font-medium text-sm">Today's Earnings</span>
              </div>
              <span className="font-black text-green-600">{fmt(todayEarnings)}</span>
            </div>
            <div className="flex justify-between items-center px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Wallet size={14} className="text-blue-600" strokeWidth={2} />
                </div>
                <span className="text-gray-700 font-medium text-sm">Total Earnings</span>
              </div>
              <span className="font-black text-gray-900">{fmt(totalEarnings)}</span>
            </div>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 text-center">
            <p className="text-xs text-gray-400">Earnings are calculated at <strong className="text-gray-600">25% commission</strong> per transaction</p>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'notifications') {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        <SubHeader title="Notifications" onBack={handleBack} />
        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Bell size={36} className="text-gray-200 mb-3" strokeWidth={1.5} />
              <p className="font-bold text-gray-400">No notifications</p>
              <p className="text-gray-300 text-sm mt-1">Check back later</p>
            </div>
          ) : notifications.map(n => (
            <div key={n.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-yellow-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  <Bell size={14} className="text-yellow-600" strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-sm">{n.title}</p>
                  <p className="text-gray-600 text-sm mt-1 leading-relaxed">{n.message}</p>
                  <p className="text-gray-400 text-xs mt-2">
                    {new Date(n.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'about') {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        <SubHeader title="About Us" onBack={handleBack} />
        <div className="p-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center mb-4">
            <div className="w-20 h-20 bg-yellow-400 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-yellow-200">
              <span className="text-3xl font-black text-gray-900">MK</span>
            </div>
            <h2 className="text-2xl font-black text-gray-900">MK Coin</h2>
            <p className="text-gray-400 text-sm mt-1">Finance Platform · v1.0.0</p>
            <div className="mt-5 text-left bg-gray-50 rounded-xl p-4">
              <p className="text-gray-600 text-sm leading-relaxed">
                MK Coin is a trusted commission-based finance platform. Every successful transaction automatically earns you <strong className="text-gray-900">25% profit</strong>. Track your earnings, manage bank accounts, and submit payment requests — all in one place.
              </p>
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <p className="text-xs text-yellow-700 font-medium">For support, contact your Admin</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      <div className="bg-yellow-400 px-5 py-5 text-center shrink-0">
        <h1 className="text-xl font-black text-gray-900">MK Coin</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-3">
        <button onClick={() => setView('profile')}
          className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 active:scale-[0.99] transition-transform">
          <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center text-white font-black text-xl shrink-0 shadow-md">
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 text-left">
            <p className="font-black text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">UID: {user?.displayId}</p>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </button>

        <div className="bg-yellow-400 rounded-2xl p-4 shadow-md shadow-yellow-200/50">
          <div className="flex items-center divide-x divide-yellow-300">
            <div className="flex-1 pr-4 text-center">
              <p className="text-yellow-800 text-xs font-medium">Today's Earn</p>
              <p className="font-black text-gray-900 text-xl mt-0.5">{fmt(todayEarnings)}</p>
            </div>
            <div className="flex-1 pl-4 text-center">
              <p className="text-yellow-800 text-xs font-medium">Total's Earn</p>
              <p className="font-black text-gray-900 text-xl mt-0.5">{fmt(totalEarnings)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {([
            { icon: Wallet, label: 'My Wallet', sub: 'View your earnings balance', action: () => setView('wallet') },
            { icon: User, label: 'Profile', sub: 'View your account info', action: () => setView('profile') },
            { icon: Bell, label: 'Notifications', sub: `${notifications.length} message${notifications.length !== 1 ? 's' : ''}`, action: () => setView('notifications') },
            { icon: Info, label: 'About Us', sub: 'About MK Coin platform', action: () => setView('about') },
          ] as { icon: React.ElementType; label: string; sub: string; action: () => void }[]).map(({ icon: Icon, label, sub, action }) => (
            <button key={label} onClick={action} className="w-full flex items-center gap-4 px-5 py-4 text-left active:bg-gray-50 transition-colors">
              <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center shrink-0">
                <Icon size={17} className="text-yellow-600" strokeWidth={1.8} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-800 text-sm">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
              <ChevronRight size={14} className="text-gray-300" />
            </button>
          ))}
        </div>

        <button onClick={logout}
          className="w-full bg-yellow-400 text-gray-900 font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-yellow-200">
          <LogOut size={17} strokeWidth={2.5} />
          Logout
        </button>
      </div>
    </div>
  );
}
