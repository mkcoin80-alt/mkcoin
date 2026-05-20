import { useEffect, useState } from 'react';
import { Users, UserCheck, CreditCard, Activity, Clock, TrendingUp } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

interface Stats {
  totalUsers: number | null;
  totalAdmins: number | null;
  totalAccounts: number | null;
  totalTransactions: number | null;
  pendingRequests: number | null;
}

export default function SAHomeScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalUsers: null, totalAdmins: null,
    totalAccounts: null, totalTransactions: null, pendingRequests: null,
  });

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const [uSnap, aSnap, accSnap, tSnap, pSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'admins')),
        getDocs(query(collection(db, 'bank_accounts'), where('is_active', '==', true))),
        getDocs(collection(db, 'transactions')),
        getDocs(collection(db, 'payment_requests')),
      ]);
      setStats({
        totalUsers: uSnap.size,
        totalAdmins: aSnap.size,
        totalAccounts: accSnap.size,
        totalTransactions: tSnap.size,
        pendingRequests: pSnap.docs.filter(d => d.data().status === 'pending').length,
      });
    } catch (e) {
      console.error('Error loading SA stats:', e);
    }
  };

  const cards = [
    { icon: Users, label: 'Total Users', value: stats.totalUsers, accent: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/8' },
    { icon: UserCheck, label: 'Total Admins', value: stats.totalAdmins, accent: 'text-teal-400', border: 'border-teal-500/20', bg: 'bg-teal-500/8' },
    { icon: CreditCard, label: 'Bank Accounts', value: stats.totalAccounts, accent: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/8' },
    { icon: Activity, label: 'Transactions', value: stats.totalTransactions, accent: 'text-yellow-400', border: 'border-yellow-500/20', bg: 'bg-yellow-500/8' },
  ] as { icon: React.ElementType; label: string; value: number | null; accent: string; border: string; bg: string }[];

  return (
    <div className="flex flex-col h-full bg-[#111111]">
      <div className="px-5 pt-8 pb-5 shrink-0">
        <p className="text-gray-500 text-sm font-medium">Logged in as</p>
        <h1 className="text-2xl font-black text-white mt-0.5">{user?.name}</h1>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-2 h-2 bg-yellow-400 rounded-full" />
          <p className="text-yellow-400 text-sm font-bold">Full Platform Access</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-6 px-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {cards.map(({ icon: Icon, label, value, accent, border, bg }) => (
            <div key={label} className={`rounded-2xl p-4 border ${border} ${bg}`}>
              <div className="w-9 h-9 rounded-xl bg-black/30 flex items-center justify-center mb-3">
                <Icon size={18} className={accent} strokeWidth={1.8} />
              </div>
              {value === null ? (
                <div className="h-8 w-12 bg-white/10 rounded-lg animate-pulse mb-1" />
              ) : (
                <p className="text-3xl font-black text-white">{value}</p>
              )}
              <p className="text-gray-500 text-xs mt-1 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {(stats.pendingRequests ?? 0) > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/25 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500/15 rounded-xl flex items-center justify-center shrink-0">
              <Clock size={17} className="text-orange-400" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <p className="text-orange-400 font-bold text-sm">
                {stats.pendingRequests} Pending Request{stats.pendingRequests !== 1 ? 's' : ''}
              </p>
              <p className="text-gray-500 text-xs mt-0.5">Go to Payments tab to review.</p>
            </div>
          </div>
        )}

        <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
            <TrendingUp size={16} className="text-yellow-400" strokeWidth={2} />
            <p className="text-white font-bold text-sm">Super Admin Powers</p>
          </div>
          <div className="px-5 py-4 space-y-2.5">
            {[
              'Create admins and users',
              'Approve / reject all payment requests',
              'Upload platform QR code',
              'Send notifications to all users',
              'View full activity logs',
              'Reset passwords & edit profiles',
              'Delete transaction histories',
              'Ban / unban admins and users',
            ].map(item => (
              <div key={item} className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full shrink-0" />
                <p className="text-gray-400 text-xs">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
