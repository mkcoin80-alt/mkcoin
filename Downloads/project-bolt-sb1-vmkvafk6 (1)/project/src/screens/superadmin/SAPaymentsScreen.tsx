import { useEffect, useState } from 'react';
import { CheckCircle, X, QrCode, Banknote, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../lib/auth';

interface PaymentReq {
  id: string;
  request_type: string;
  amount: number;
  payable_amount: number;
  status: string;
  created_at: string;
  user_name: string;
  user_display_id: string;
}

type Tab = 'pending' | 'approved' | 'rejected';

export default function SAPaymentsScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('pending');
  const [requests, setRequests] = useState<PaymentReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, [tab]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const snap = await getDocs(
        query(collection(db, 'payment_requests'), where('status', '==', tab))
      );
      const items: PaymentReq[] = await Promise.all(
        snap.docs.map(async d => {
          const data = d.data();
          let user_name = '';
          let user_display_id = '';
          if (data.user_id) {
            try {
              const uSnap = await getDoc(doc(db, 'users', data.user_id));
              if (uSnap.exists()) {
                const ud = uSnap.data();
                user_name = ud.name || '';
                user_display_id = ud.user_id || '';
              }
            } catch { /* ignore */ }
          }
          return {
            id: d.id,
            request_type: data.request_type,
            amount: data.amount,
            payable_amount: data.payable_amount,
            status: data.status,
            created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
            user_name,
            user_display_id,
          };
        })
      );
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRequests(items);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
        setError('Firestore rules are blocking reads. In Firebase Console → Firestore → Rules, set: allow read, write: if true;');
      } else {
        setError('Failed to load requests: ' + msg);
      }
      console.error('SAPaymentsScreen loadData error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (req: PaymentReq, action: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'payment_requests', req.id), {
        status: action,
        reviewed_by_super_admin: user!.id,
        reviewed_at: serverTimestamp(),
      });
      await logActivity('superadmin', user!.id, user!.displayId,
        `${req.request_type}_payment_${action}`, 'payment_request', req.id, '', { amount: req.amount });
      showToast(`Request ${action}.`);
      loadData();
    } catch (e) {
      console.error('Error handling payment action:', e);
      showToast('Action failed. Try again.');
    }
  };

  const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#111111]">
      <div className="px-5 pt-8 pb-0 shrink-0">
        <h1 className="text-2xl font-black text-white">Payment Requests</h1>
        <p className="text-gray-500 text-sm mt-0.5">All online and cash requests</p>
      </div>

      <div className="flex gap-2 px-5 py-4 shrink-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-colors ${tab === t.id ? 'bg-yellow-400 text-gray-900' : 'bg-white/[0.06] text-gray-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-6 px-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white/[0.04] rounded-2xl p-4 h-32 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-52 text-center gap-3">
            <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-400" strokeWidth={1.8} />
            </div>
            <p className="text-red-400 text-sm font-bold">Firestore Access Error</p>
            <p className="text-gray-500 text-xs leading-relaxed px-4">{error}</p>
            <button onClick={loadData} className="flex items-center gap-2 bg-yellow-400 text-gray-900 font-bold px-4 py-2 rounded-xl text-sm active:scale-95 transition-transform">
              <RefreshCw size={13} strokeWidth={2.5} /> Retry
            </button>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-center">
            <div className="w-14 h-14 bg-white/[0.04] rounded-full flex items-center justify-center mb-3">
              <Clock size={26} className="text-gray-600" strokeWidth={1.5} />
            </div>
            <p className="text-gray-400 font-bold text-sm">No {tab} requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(req => (
              <div key={req.id} className="bg-white/[0.04] rounded-2xl p-4 border border-white/[0.07]">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${req.request_type === 'online' ? 'bg-blue-500/15' : 'bg-emerald-500/15'}`}>
                        {req.request_type === 'online'
                          ? <QrCode size={13} className="text-blue-400" strokeWidth={2} />
                          : <Banknote size={13} className="text-emerald-400" strokeWidth={2} />
                        }
                      </div>
                      <span className={`text-xs font-black uppercase ${req.request_type === 'online' ? 'text-blue-400' : 'text-emerald-400'}`}>
                        {req.request_type}
                      </span>
                    </div>
                    <p className="text-white font-black text-2xl leading-tight">{fmt(req.amount)}</p>
                    <p className="text-gray-400 text-sm mt-0.5">Payable: <span className="text-yellow-400 font-bold">{fmt(req.payable_amount)}</span></p>
                    <p className="text-gray-500 text-xs mt-0.5">{req.user_name} · {req.user_display_id}</p>
                    <p className="text-gray-700 text-xs mt-0.5">{fmtDate(req.created_at)}</p>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-lg shrink-0 ml-3 ${
                    req.status === 'pending' ? 'bg-orange-500/15 text-orange-400' :
                    req.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400' :
                    'bg-red-500/15 text-red-400'
                  }`}>
                    {req.status}
                  </span>
                </div>

                {tab === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(req, 'approved')}
                      className="flex-1 bg-emerald-500/10 text-emerald-400 font-black py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 border border-emerald-500/25 active:scale-[0.98] transition-transform"
                    >
                      <CheckCircle size={14} strokeWidth={2} /> Approve
                    </button>
                    <button
                      onClick={() => handleAction(req, 'rejected')}
                      className="flex-1 bg-red-500/10 text-red-400 font-black py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 border border-red-500/25 active:scale-[0.98] transition-transform"
                    >
                      <X size={14} strokeWidth={2} /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 bg-gray-800 border border-white/10 text-white text-sm px-4 py-3 rounded-2xl z-50 text-center shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
