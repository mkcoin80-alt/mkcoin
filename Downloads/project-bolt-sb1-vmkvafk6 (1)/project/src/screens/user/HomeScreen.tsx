import { useEffect, useState, useRef } from 'react';
import { Bell, CheckCircle, Clock, TrendingUp, IndianRupee, Gift, Zap } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

interface Stats {
  todayEarnings: number;
  totalEarnings: number;
  todayVolume: number;
  totalTransactions: number;
  todaySuccess: number;
  pendingRequests: number;
}

interface Props {
  onNotifPress?: () => void;
}

const BANNERS = [
  { title: 'Add more accounts', subtitle: 'to earn money', bg: 'from-yellow-400 to-amber-500', icon: Gift },
  { title: 'Every trade earns', subtitle: '25% commission', bg: 'from-amber-500 to-orange-500', icon: TrendingUp },
  { title: 'Fast & secure', subtitle: 'payments daily', bg: 'from-orange-400 to-red-400', icon: Zap },
];

export default function HomeScreen({ onNotifPress }: Props) {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    todayEarnings: 0, totalEarnings: 0, todayVolume: 0,
    totalTransactions: 0, todaySuccess: 0, pendingRequests: 0,
  });
  const [notifCount, setNotifCount] = useState(0);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    loadStats();
    checkNotifs();
    timerRef.current = setInterval(() => setBannerIdx(i => (i + 1) % BANNERS.length), 3500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [user]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [txnSnap, prSnap] = await Promise.all([
        getDocs(query(collection(db, 'transactions'), where('user_id', '==', user!.id))),
        getDocs(query(collection(db, 'payment_requests'), where('user_id', '==', user!.id))),
      ]);
      const txns = txnSnap.docs.map(d => d.data());
      const pendingCount = prSnap.docs.filter(d => d.data().status === 'pending').length;
      const todayItems = txns.filter(t => {
        const ts = t.created_at?.toDate?.() || new Date();
        return ts >= today;
      });
      setStats({
        todayEarnings: todayItems.reduce((s, t) => s + Number(t.earning || 0), 0),
        totalEarnings: txns.reduce((s, t) => s + Number(t.earning || 0), 0),
        todayVolume: todayItems.reduce((s, t) => s + Number(t.amount || 0), 0),
        totalTransactions: txns.length,
        todaySuccess: todayItems.length,
        pendingRequests: pendingCount,
      });
    } catch (e) {
      console.error('Error loading stats:', e);
    } finally {
      setLoading(false);
    }
  };

  const checkNotifs = async () => {
    try {
      const snap = await getDocs(collection(db, 'notifications'));
      setNotifCount(snap.size);
    } catch { /* ignore */ }
  };

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const currentBanner = BANNERS[bannerIdx];
  const BannerIcon = currentBanner.icon;

  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      <div className="bg-white px-5 py-4 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.06)] shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-yellow-400 rounded-lg flex items-center justify-center">
              <span className="text-xs font-black text-gray-900">MK</span>
            </div>
            <h1 className="text-lg font-black text-gray-900 tracking-tight">MK Coin</h1>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Hello, <span className="font-semibold text-gray-600">{user?.name}</span>
          </p>
        </div>
        <button
          onClick={onNotifPress}
          className="relative w-10 h-10 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
        >
          <Bell size={18} className="text-gray-600" strokeWidth={1.8} />
          {notifCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-[9px] font-black text-white px-0.5">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-24 space-y-4">
          <div className={`rounded-3xl overflow-hidden bg-gradient-to-br ${currentBanner.bg} p-5 shadow-lg relative`} style={{ minHeight: 130 }}>
            <div className="relative z-10">
              <p className="text-white/90 font-semibold text-base leading-snug">{currentBanner.title}</p>
              <p className="text-white font-black text-2xl leading-snug mt-0.5">{currentBanner.subtitle}</p>
            </div>
            <div className="absolute right-5 top-1/2 -translate-y-1/2">
              <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center">
                <BannerIcon size={40} className="text-white" strokeWidth={1.5} />
              </div>
            </div>
            <div className="flex gap-1.5 mt-4 relative z-10">
              {BANNERS.map((_, i) => (
                <button key={i} onClick={() => setBannerIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${i === bannerIdx ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`} />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex divide-x divide-gray-100">
              <div className="flex-1 px-4 py-3 text-center">
                <p className="text-[10px] text-gray-400 font-medium">Total Earned</p>
                {loading ? <div className="h-5 w-16 bg-gray-100 rounded animate-pulse mx-auto mt-1" />
                  : <p className="text-base font-black text-gray-900 mt-0.5">₹{fmt(stats.totalEarnings)}</p>}
              </div>
              <div className="flex-1 px-4 py-3 text-center">
                <p className="text-[10px] text-gray-400 font-medium">Transactions</p>
                {loading ? <div className="h-5 w-10 bg-gray-100 rounded animate-pulse mx-auto mt-1" />
                  : <p className="text-base font-black text-gray-900 mt-0.5">{stats.totalTransactions}</p>}
              </div>
              <div className="flex-1 px-4 py-3 text-center">
                <p className="text-[10px] text-gray-400 font-medium">Pending</p>
                {loading ? <div className="h-5 w-8 bg-gray-100 rounded animate-pulse mx-auto mt-1" />
                  : <p className={`text-base font-black mt-0.5 ${stats.pendingRequests > 0 ? 'text-orange-500' : 'text-gray-900'}`}>
                      {stats.pendingRequests}
                    </p>}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl px-4 py-3.5 flex items-center justify-between shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-yellow-400 rounded-xl flex items-center justify-center shadow-sm">
                <IndianRupee size={16} className="text-gray-900" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-medium leading-none">Commission Rate</p>
                <p className="text-xl font-black text-gray-900 mt-0.5">25%</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Per Transaction</p>
              <p className="text-sm font-bold text-green-600">Auto Calculated</p>
            </div>
          </div>

          <Section title="Today's Activity">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Today's Volume" value={loading ? null : `₹${fmt(stats.todayVolume)}`} icon={Clock} iconColor="text-amber-500" bg="bg-amber-50 border-amber-100" />
              <StatCard label="Today's Trades" value={loading ? null : String(stats.todaySuccess)} icon={CheckCircle} iconColor="text-blue-500" bg="bg-blue-50 border-blue-100" />
            </div>
          </Section>

          <Section title="Today's Earnings">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Profit Today" value={loading ? null : `₹${fmt(stats.todayEarnings)}`} icon={TrendingUp} iconColor="text-amber-500" bg="bg-amber-50 border-amber-100" />
              <StatCard label="Successful" value={loading ? null : String(stats.todaySuccess)} icon={CheckCircle} iconColor="text-green-500" bg="bg-green-50 border-green-100" />
            </div>
          </Section>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-400 to-amber-400 px-4 py-3 flex items-center gap-2">
              <TrendingUp size={17} className="text-gray-900" strokeWidth={2.5} />
              <span className="font-black text-gray-900 text-sm">Trading Rewards</span>
            </div>
            <div className="px-4 py-4">
              <p className="text-xs text-gray-500 text-center mb-3">
                You receive <span className="font-bold text-gray-800">25%</span> of every transaction as profit
              </p>
              <div className="space-y-2">
                {[
                  { trade: '₹1,000', earn: '₹250' },
                  { trade: '₹5,000', earn: '₹1,250' },
                  { trade: '₹10,000', earn: '₹2,500' },
                ].map(row => (
                  <div key={row.trade} className="flex items-center justify-between bg-yellow-50 border border-yellow-100 rounded-xl px-3.5 py-2.5">
                    <span className="text-xs text-gray-600 font-medium">Trade {row.trade}</span>
                    <span className="text-xs font-black text-amber-600">Earn {row.earn}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-[3px] h-5 bg-yellow-400 rounded-full" />
        <h2 className="font-black text-gray-800 text-sm">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, iconColor, bg }: {
  label: string; value: string | null; icon: React.ElementType; iconColor: string; bg: string;
}) {
  return (
    <div className={`rounded-2xl p-4 border ${bg}`}>
      <Icon size={22} className={`${iconColor} mb-2`} strokeWidth={1.8} />
      {value === null ? (
        <div className="h-6 w-20 bg-gray-200 rounded animate-pulse mb-1" />
      ) : (
        <p className="text-lg font-black text-gray-900 leading-tight">{value}</p>
      )}
      <p className="text-[11px] text-gray-500 mt-1 font-medium">{label}</p>
    </div>
  );
}
