import { useEffect, useState } from 'react';
import { CheckCircle, X, IndianRupee, History, RefreshCw, AlertTriangle } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../lib/auth';

interface PaymentRequest {
  id: string;
  request_type: string;
  amount: number;
  payable_amount: number;
  status: string;
  created_at: string;
  user_name: string;
  user_display_id: string;
}

interface Transaction {
  id: string;
  amount: number;
  earning: number;
  description: string;
  created_at: string;
  user_name: string;
  user_display_id: string;
}

type Tab = 'pending' | 'approved' | 'rejected' | 'myHistory';

const TAB_LABELS: Record<Tab, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  myHistory: 'My History',
};

async function resolveUser(userId: string): Promise<{ name: string; display_id: string }> {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (snap.exists()) {
      const d = snap.data();
      return { name: d.name || '', display_id: d.user_id || '' };
    }
  } catch { /* ignore */ }
  return { name: '', display_id: '' };
}

export default function AdminHistoryScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('pending');
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, [tab]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'myHistory') {
        const snap = await getDocs(
          query(collection(db, 'transactions'), where('created_by_admin', '==', user!.id))
        );
        const items: Transaction[] = await Promise.all(
          snap.docs.map(async d => {
            const data = d.data();
            const uInfo = data.user_id ? await resolveUser(data.user_id) : { name: '', display_id: '' };
            return {
              id: d.id,
              amount: data.amount,
              earning: data.earning,
              description: data.description || '',
              created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
              user_name: uInfo.name,
              user_display_id: uInfo.display_id,
            };
          })
        );
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setTransactions(items);
      } else {
        const snap = await getDocs(
          query(collection(db, 'payment_requests'), where('status', '==', tab))
        );
        const items: PaymentRequest[] = await Promise.all(
          snap.docs.map(async d => {
            const data = d.data();
            const uInfo = data.user_id ? await resolveUser(data.user_id) : { name: '', display_id: '' };
            return {
              id: d.id,
              request_type: data.request_type || 'cash',
              amount: data.amount,
              payable_amount: data.payable_amount,
              status: data.status,
              created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
              user_name: uInfo.name,
              user_display_id: uInfo.display_id,
            };
          })
        );
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setRequests(items);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
        setError('Firestore rules are blocking reads. In Firebase Console → Firestore → Rules, set: allow read, write: if true;');
      } else {
        setError('Failed to load data: ' + msg);
      }
      console.error('AdminHistoryScreen loadData error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (req: PaymentRequest) => {
    try {
      await updateDoc(doc(db, 'payment_requests', req.id), {
        status: 'approved',
        reviewed_by_admin: user!.id,
        reviewed_at: serverTimestamp(),
      });
      await logActivity('admin', user!.id, user!.displayId, 'payment_request_approved', 'payment_request', req.id, '', { amount: req.amount });
      showToast('Request approved.');
      loadData();
    } catch (e) {
      console.error('Error approving request:', e);
      showToast('Failed to approve. Try again.');
    }
  };

  const handleReject = async (req: PaymentRequest) => {
    try {
      await updateDoc(doc(db, 'payment_requests', req.id), {
        status: 'rejected',
        reviewed_by_admin: user!.id,
        reviewed_at: serverTimestamp(),
      });
      await logActivity('admin', user!.id, user!.displayId, 'payment_request_rejected', 'payment_request', req.id, '', { amount: req.amount });
      showToast('Request rejected.');
      loadData();
    } catch (e) {
      console.error('Error rejecting request:', e);
      showToast('Failed to reject. Try again.');
    }
  };

  const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtShort = (d: string) =>
    new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full bg-[#111111]">
      <div className="px-5 pt-8 pb-0 shrink-0 flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">History</h1>
        <button onClick={loadData} className="w-9 h-9 bg-white/[0.06] rounded-xl flex items-center justify-center active:scale-95 transition-transform">
          <RefreshCw size={15} className="text-gray-400" strokeWidth={2} />
        </button>
      </div>

      <div className="flex gap-2 px-5 py-4 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors shrink-0 ${tab === t ? 'bg-yellow-400 text-gray-900' : 'bg-white/[0.06] text-gray-400'}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-24 px-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white/[0.04] rounded-2xl p-4 h-28 animate-pulse" />
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
        ) : tab === 'myHistory' ? (
          transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-center">
              <div className="w-14 h-14 bg-white/[0.04] rounded-full flex items-center justify-center mb-3">
                <History size={26} className="text-gray-600" strokeWidth={1.5} />
              </div>
              <p className="text-gray-400 font-bold text-sm">No transactions added yet</p>
              <p className="text-gray-600 text-xs mt-1">Add transactions from the Search tab</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map(t => (
                <div key={t.id} className="bg-white/[0.04] rounded-2xl p-4 border border-white/[0.06]">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black text-xl">{fmt(t.amount)}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <IndianRupee size={11} className="text-emerald-400" strokeWidth={2.5} />
                        <p className="text-emerald-400 text-sm font-bold">Earning: {fmt(t.earning)}</p>
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        {t.user_name}{t.user_display_id ? ` · ${t.user_display_id}` : ''}
                      </p>
                      {t.description && (
                        <p className="text-gray-600 text-xs mt-0.5 truncate">"{t.description}"</p>
                      )}
                    </div>
                    <p className="text-gray-600 text-xs text-right shrink-0 ml-3">{fmtShort(t.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-center">
              <div className="w-14 h-14 bg-white/[0.04] rounded-full flex items-center justify-center mb-3">
                <CheckCircle size={26} className="text-gray-600" strokeWidth={1.5} />
              </div>
              <p className="text-gray-400 font-bold text-sm">No {TAB_LABELS[tab].toLowerCase()} requests</p>
              <p className="text-gray-600 text-xs mt-1">Payment requests appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(req => (
                <div key={req.id} className="bg-white/[0.04] rounded-2xl p-4 border border-white/[0.07]">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${req.request_type === 'online' ? 'bg-blue-500/15 text-blue-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                          {req.request_type === 'online' ? 'Online' : 'Cash'}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                          tab === 'pending' ? 'bg-orange-500/15 text-orange-400' :
                          tab === 'approved' ? 'bg-blue-500/15 text-blue-400' :
                          'bg-red-500/15 text-red-400'
                        }`}>
                          {TAB_LABELS[tab]}
                        </span>
                      </div>
                      <p className="text-white font-black text-2xl">{fmt(req.amount)}</p>
                      <p className="text-gray-400 text-sm mt-0.5">
                        {req.user_name}{req.user_display_id ? ` · ${req.user_display_id}` : ''}
                      </p>
                      <p className="text-gray-600 text-xs mt-0.5">{fmtDate(req.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-gray-500 text-xs">Payable</p>
                      <p className="text-yellow-400 font-black">{fmt(req.payable_amount)}</p>
                    </div>
                  </div>
                  {tab === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(req)}
                        className="flex-1 bg-emerald-500/10 text-emerald-400 font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 border border-emerald-500/25 active:scale-[0.98] transition-transform"
                      >
                        <CheckCircle size={14} strokeWidth={2} /> Approve
                      </button>
                      <button
                        onClick={() => handleReject(req)}
                        className="flex-1 bg-red-500/10 text-red-400 font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 border border-red-500/25 active:scale-[0.98] transition-transform"
                      >
                        <X size={14} strokeWidth={2} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
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
