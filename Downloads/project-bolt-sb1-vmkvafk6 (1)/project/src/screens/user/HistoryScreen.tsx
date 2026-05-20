import { useEffect, useState } from 'react';
import {
  ArrowDownCircle, ChevronDown, ChevronUp,
  QrCode, Banknote, X, CheckCircle, Clock,
  User, CreditCard, Building2, Calendar, AlertCircle,
  RefreshCw, IndianRupee, AlertTriangle,
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, getDoc, addDoc, serverTimestamp, documentId, doc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

interface BankRef {
  holder_name: string;
  account_number: string;
  ifsc_code: string;
}

interface Transaction {
  id: string;
  amount: number;
  earning: number;
  type: string;
  status: string;
  description: string;
  created_at: string;
  bank_account: BankRef | null;
  bank_account_id: string;
}

interface PaymentReq {
  id: string;
  transaction_id: string;
  request_type: string;
  status: string;
  amount: number;
  payable_amount: number;
}

const STATUS_STYLES: Record<string, { pill: string; label: string }> = {
  pending:  { pill: 'bg-orange-100 text-orange-700',  label: 'Pending' },
  approved: { pill: 'bg-blue-100 text-blue-700',      label: 'Approved' },
  rejected: { pill: 'bg-red-100 text-red-700',        label: 'Rejected' },
};

export default function HistoryScreen() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentReqs, setPaymentReqs] = useState<PaymentReq[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [payModal, setPayModal] = useState<{ txnId: string; amount: number; payable: number } | null>(null);
  const [qrModal, setQrModal] = useState<{ txnId: string; amount: number; payable: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState<'all' | 'success' | 'requested' | 'rejected'>('all');

  useEffect(() => { loadData(); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [txnSnap, prSnap, qrSnap, qrSettingsSnap] = await Promise.all([
        getDocs(query(collection(db, 'transactions'), where('user_id', '==', user!.id))),
        getDocs(query(collection(db, 'payment_requests'), where('user_id', '==', user!.id))),
        getDocs(collection(db, 'qr_codes')),
        getDoc(doc(db, 'settings', 'qr_code')).catch(() => null),
      ]);

      const bankIds = [...new Set(txnSnap.docs.map(d => d.data().bank_account_id).filter(Boolean))];
      const bankMap: Record<string, BankRef> = {};
      if (bankIds.length > 0) {
        try {
          const bankSnap = await getDocs(query(collection(db, 'bank_accounts'), where(documentId(), 'in', bankIds.slice(0, 10))));
          bankSnap.docs.forEach(d => {
            const data = d.data();
            bankMap[d.id] = { holder_name: data.holder_name || '', account_number: data.account_number || '', ifsc_code: data.ifsc_code || '' };
          });
        } catch { /* bank lookup is optional */ }
      }

      const txnList = txnSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          amount: data.amount || 0,
          earning: data.earning || 0,
          type: data.type || data.history_type || 'success',
          status: data.status || 'success',
          description: data.description || '',
          created_at: data.created_at?.toDate?.()?.toISOString() || new Date(0).toISOString(),
          bank_account: data.bank_account_id ? (bankMap[data.bank_account_id] || null) : null,
          bank_account_id: data.bank_account_id || '',
        };
      });
      txnList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setTransactions(txnList);

      const prList = prSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          transaction_id: data.transaction_id || data.history_id || '',
          request_type: data.request_type || '',
          status: data.status || '',
          amount: data.amount || 0,
          payable_amount: data.payable_amount || 0,
        };
      });
      setPaymentReqs(prList);

      // Prefer settings/qr_code canonical doc, fall back to qr_codes collection
      if (qrSettingsSnap && qrSettingsSnap.exists()) {
        setQrUrl(qrSettingsSnap.data().image_url || qrSettingsSnap.data().qr_image_url || null);
      } else {
        const qrDocs = qrSnap.docs.sort((a, b) => {
          const ta = a.data().created_at?.toDate?.()?.getTime() || 0;
          const tb = b.data().created_at?.toDate?.()?.getTime() || 0;
          return tb - ta;
        });
        setQrUrl(qrDocs.length > 0 ? (qrDocs[0].data().qr_image_url || null) : null);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
        setError('Firestore rules are blocking reads. Set rules to: allow read, write: if true;');
      } else {
        setError('Failed to load history: ' + msg);
      }
      console.error('HistoryScreen loadData error:', e);
    } finally {
      setLoading(false);
    }
  };

  const getReq = (txnId: string) => paymentReqs.find(p => p.transaction_id === txnId);

  const handleTap = (t: Transaction) => {
    const nowOpen = expanded === t.id;
    setExpanded(nowOpen ? null : t.id);
    if (!nowOpen && t.type === 'success') {
      const req = getReq(t.id);
      if (req) return;
      setPayModal({ txnId: t.id, amount: t.amount, payable: Math.round(t.amount * 0.75 * 100) / 100 });
    }
  };

  const submitCash = async () => {
    if (!payModal || submitting) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'payment_requests'), {
        user_id: user!.id,
        transaction_id: payModal.txnId,
        request_type: 'cash',
        amount: payModal.amount,
        payable_amount: payModal.payable,
        status: 'pending',
        created_at: serverTimestamp(),
      });
      setPayModal(null);
      showToast('Cash request submitted. Waiting for approval.');
      loadData();
    } catch (e) {
      console.error('submitCash error:', e);
      showToast('Failed to submit request. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const openQr = () => { if (!payModal) return; setQrModal(payModal); setPayModal(null); };

  const submitOnline = async () => {
    if (!qrModal || submitting) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'payment_requests'), {
        user_id: user!.id,
        transaction_id: qrModal.txnId,
        request_type: 'online',
        amount: qrModal.amount,
        payable_amount: qrModal.payable,
        status: 'pending',
        created_at: serverTimestamp(),
      });
      setQrModal(null);
      showToast('Payment submitted. Awaiting verification.');
      loadData();
    } catch (e) {
      console.error('submitOnline error:', e);
      showToast('Failed to submit payment. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtAmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtShort = (d: string) =>
    new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const getEffectiveStatus = (t: Transaction) => {
    const req = getReq(t.id);
    if (req) return req.status; // pending / approved / rejected
    return t.status || t.type || 'success';
  };

  const filtered = transactions.filter(t => {
    if (filter === 'all') return true;
    const s = getEffectiveStatus(t);
    if (filter === 'success') return s === 'approved' || s === 'success';
    if (filter === 'requested') return s === 'pending' || s === 'requested';
    if (filter === 'rejected') return s === 'rejected';
    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#f5f5f5]">
        <div className="bg-yellow-400 px-5 pt-6 pb-5">
          <div className="h-7 w-28 bg-yellow-300 rounded animate-pulse mb-1" />
          <div className="h-4 w-36 bg-yellow-300 rounded animate-pulse" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-yellow-400 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3, borderStyle: 'solid' }} />
            <p className="text-gray-400 text-sm">Loading history...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-[#f5f5f5]">
        <div className="bg-yellow-400 px-5 pt-6 pb-5 shrink-0">
          <h1 className="text-2xl font-black text-gray-900">History</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle size={26} className="text-red-500" strokeWidth={1.8} />
          </div>
          <p className="text-red-600 text-sm font-bold text-center">Could Not Load History</p>
          <p className="text-gray-500 text-xs text-center leading-relaxed">{error}</p>
          <button onClick={loadData} className="flex items-center gap-2 bg-yellow-400 text-gray-900 font-bold px-5 py-2.5 rounded-xl text-sm active:scale-95 transition-transform">
            <RefreshCw size={14} strokeWidth={2.5} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      <div className="bg-yellow-400 px-5 pt-6 pb-4 shrink-0">
        <h1 className="text-2xl font-black text-gray-900">History</h1>
        <p className="text-yellow-800 text-sm font-medium mt-0.5">
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex gap-1.5 px-4 py-3 bg-white border-b border-gray-100 shrink-0 items-center overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {([
          { id: 'all' as const, label: 'All' },
          { id: 'success' as const, label: 'Success' },
          { id: 'requested' as const, label: 'Pending' },
          { id: 'rejected' as const, label: 'Rejected' },
        ]).map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${filter === f.id ? 'bg-yellow-400 text-gray-900' : 'bg-gray-100 text-gray-500'}`}>
            {f.label}
          </button>
        ))}
        <button onClick={loadData} className="ml-auto w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-transform shrink-0">
          <RefreshCw size={14} className="text-gray-500" strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Clock size={36} className="text-gray-200 mb-3" strokeWidth={1.5} />
            <p className="font-bold text-gray-400">
              {filter === 'all' ? 'No transactions yet' :
               filter === 'requested' ? 'No pending transactions' :
               `No ${filter} transactions`}
            </p>
            <p className="text-gray-300 text-sm mt-1">Your history will appear here</p>
          </div>
        ) : filtered.map(t => {
          const req = getReq(t.id);
          const isOpen = expanded === t.id;
          const isSuccess = t.type === 'success';
          const reqStyle = req ? STATUS_STYLES[req.status] : null;

          return (
            <div key={t.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
              <button className="w-full px-4 py-4 flex items-center gap-3 text-left active:bg-gray-50 transition-colors" onClick={() => handleTap(t)}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSuccess ? 'bg-green-100' : 'bg-amber-100'}`}>
                  <ArrowDownCircle size={20} className={isSuccess ? 'text-green-600' : 'text-amber-600'} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Amount</p>
                  <p className="text-xl font-black text-gray-900 leading-tight">{fmtAmt(t.amount)}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isSuccess ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {t.type}
                    </span>
                    {req && reqStyle && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${reqStyle.pill}`}>
                        {req.request_type} · {reqStyle.label}
                      </span>
                    )}
                    {isSuccess && !req && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Tap to pay</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <p className="text-xs text-gray-400 leading-snug">{fmtShort(t.created_at)}</p>
                  {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100">
                  <div className="mx-4 my-3 rounded-xl overflow-hidden border border-gray-100">
                    {[
                      ...(t.bank_account ? [
                        { icon: User, label: 'Account Name', value: t.bank_account.holder_name },
                        { icon: CreditCard, label: 'Account No.', value: t.bank_account.account_number },
                        { icon: Building2, label: 'IFSC Code', value: t.bank_account.ifsc_code },
                      ] : []),
                      { icon: IndianRupee, label: 'Earning (25%)', value: fmtAmt(t.earning), green: true },
                      { icon: Calendar, label: 'Date & Time', value: fmtDate(t.created_at) },
                      ...(t.description ? [{ icon: CheckCircle, label: 'Note', value: t.description }] : []),
                      ...(req ? [
                        {
                          icon: req.status === 'approved' ? CheckCircle : req.status === 'rejected' ? AlertCircle : Clock,
                          label: 'Payment Status',
                          value: `${req.request_type.toUpperCase()} — ${STATUS_STYLES[req.status]?.label || req.status}`,
                          statusColor: req.status === 'approved' ? 'text-blue-600' : req.status === 'rejected' ? 'text-red-500' : 'text-orange-600',
                        },
                        { icon: IndianRupee, label: 'Amount Payable (75%)', value: fmtAmt(req.payable_amount) },
                      ] : []),
                    ].map(({ icon: Icon, label, value, green, statusColor }, idx) => (
                      <div key={label} className={`flex items-center gap-3 px-4 py-3 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                        <div className="w-7 h-7 bg-yellow-100 rounded-lg flex items-center justify-center shrink-0">
                          <Icon size={13} className="text-yellow-600" strokeWidth={2} />
                        </div>
                        <span className="text-gray-500 text-xs flex-1">{label}</span>
                        <span className={`font-bold text-sm text-right break-all ${green ? 'text-green-600' : statusColor || 'text-gray-900'}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {payModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setPayModal(null)}>
          <div className="bg-white rounded-t-3xl w-full p-6 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h3 className="text-xl font-black text-gray-900 mb-1">Choose Payment Method</h3>
            <p className="text-gray-400 text-sm mb-5">Select how you want to pay</p>
            <div className="bg-gray-50 rounded-2xl p-4 mb-5 border border-gray-100">
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-gray-500">Original Amount</span>
                <span className="font-black text-gray-900">{fmtAmt(payModal.amount)}</span>
              </div>
              <div className="h-px bg-gray-200 mb-2" />
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">You Pay (75%)</span>
                <span className="font-black text-green-600 text-xl">{fmtAmt(payModal.payable)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1.5 text-center">You keep 25% as your profit</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={openQr} className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 flex flex-col items-center gap-2.5 active:scale-95 transition-transform">
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <QrCode size={28} className="text-blue-600" strokeWidth={1.8} />
                </div>
                <span className="font-black text-blue-700">Online</span>
                <span className="text-xs text-blue-400 text-center leading-tight">Scan QR & pay</span>
              </button>
              <button onClick={submitCash} disabled={submitting} className="bg-green-50 border-2 border-green-200 rounded-2xl p-5 flex flex-col items-center gap-2.5 active:scale-95 transition-transform disabled:opacity-60">
                <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
                  <Banknote size={28} className="text-green-600" strokeWidth={1.8} />
                </div>
                <span className="font-black text-green-700">Cash</span>
                <span className="text-xs text-green-400 text-center leading-tight">{submitting ? 'Submitting...' : 'Pay in person'}</span>
              </button>
            </div>
            <button onClick={() => setPayModal(null)} className="w-full py-3 text-gray-400 text-sm font-medium active:opacity-70 transition-opacity">Cancel</button>
          </div>
        </div>
      )}

      {qrModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={() => setQrModal(null)}>
          <div className="bg-white rounded-t-3xl w-full p-6 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-black text-gray-900">Scan & Pay</h3>
              <button onClick={() => setQrModal(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-transform">
                <X size={16} className="text-gray-600" />
              </button>
            </div>
            <div className="bg-gradient-to-r from-yellow-400 to-amber-400 rounded-2xl p-4 mb-5 text-center">
              <p className="text-yellow-800 text-sm font-medium">Amount to Pay</p>
              <p className="text-4xl font-black text-gray-900 mt-1">{fmtAmt(qrModal.payable)}</p>
              <p className="text-yellow-800 text-xs mt-1">{fmtAmt(qrModal.amount)} × 75% = {fmtAmt(qrModal.payable)}</p>
            </div>
            <div className="flex justify-center mb-5">
              {qrUrl ? (
                <div className="p-3 bg-white border-2 border-yellow-400 rounded-2xl shadow-lg">
                  <img src={qrUrl} alt="Payment QR Code" className="w-44 h-44 object-contain" />
                </div>
              ) : (
                <div className="w-52 h-52 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2">
                  <QrCode size={40} className="text-gray-300" strokeWidth={1.5} />
                  <p className="text-gray-400 text-xs text-center">QR code not available.<br />Contact admin.</p>
                </div>
              )}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-center">
              <p className="text-xs text-amber-700 font-medium">
                Pay exactly <strong>{fmtAmt(qrModal.payable)}</strong>, then tap "I Have Paid"
              </p>
            </div>
            <button onClick={submitOnline} disabled={submitting}
              className="w-full bg-yellow-400 text-gray-900 font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 shadow-lg shadow-yellow-200">
              <CheckCircle size={18} strokeWidth={2.5} />
              {submitting ? 'Submitting...' : 'I Have Paid'}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 bg-gray-900 text-white text-sm px-4 py-3 rounded-2xl z-50 text-center shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
