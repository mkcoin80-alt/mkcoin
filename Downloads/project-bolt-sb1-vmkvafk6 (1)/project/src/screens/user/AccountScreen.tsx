import { useEffect, useState } from 'react';
import { Trash2, Building2, CreditCard, ChevronRight, Phone, MapPin, Hash, AlertTriangle, RefreshCw } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../lib/auth';

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  holder_name: string;
  contact_number: string;
  account_address: string;
  created_at: string;
}

const AVATAR_COLORS = [
  ['bg-blue-100', 'text-blue-700'],
  ['bg-emerald-100', 'text-emerald-700'],
  ['bg-amber-100', 'text-amber-700'],
  ['bg-rose-100', 'text-rose-700'],
  ['bg-teal-100', 'text-teal-700'],
  ['bg-orange-100', 'text-orange-700'],
  ['bg-cyan-100', 'text-cyan-700'],
];

export default function AccountScreen() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<BankAccount | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<BankAccount | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { loadAccounts(); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const loadAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      const snap = await getDocs(
        query(collection(db, 'bank_accounts'), where('user_id', '==', user!.id))
      );
      const list = snap.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            bank_name: data.bank_name || '',
            account_number: data.account_number || '',
            ifsc_code: data.ifsc_code || '',
            holder_name: data.holder_name || '',
            contact_number: data.contact_number || '',
            account_address: data.account_address || '',
            is_active: data.is_active !== false,
            created_at: data.created_at?.toDate?.()?.toISOString() || new Date(0).toISOString(),
          };
        })
        .filter(a => a.is_active)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAccounts(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
        setError('Firestore rules are blocking reads. In Firebase Console → Firestore → Rules, set: allow read, write: if true;');
      } else {
        setError('Failed to load accounts: ' + msg);
      }
      console.error('AccountScreen loadAccounts error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm || deleting) return;
    setDeleting(true);
    try {
      await updateDoc(doc(db, 'bank_accounts', deleteConfirm.id), { is_active: false });
      await logActivity('user', user!.id, user!.displayId, 'bank_account_deleted', 'bank_account', deleteConfirm.id);
      showToast('Account removed.');
      loadAccounts();
    } catch (e) {
      console.error('Delete error:', e);
      showToast('Failed to remove account.');
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="bg-yellow-400 px-5 pt-6 pb-5">
          <div className="h-7 w-40 bg-yellow-300 rounded animate-pulse mb-1" />
          <div className="h-4 w-24 bg-yellow-300 rounded animate-pulse" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-yellow-400 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
            <p className="text-gray-400 text-sm">Loading accounts...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="bg-yellow-400 px-5 pt-6 pb-5 shrink-0">
          <h1 className="text-2xl font-black text-gray-900">All Accounts</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle size={26} className="text-red-500" strokeWidth={1.8} />
          </div>
          <p className="text-red-600 text-sm font-bold text-center">Firestore Access Error</p>
          <p className="text-gray-500 text-xs text-center leading-relaxed">{error}</p>
          <button onClick={loadAccounts} className="flex items-center gap-2 bg-yellow-400 text-gray-900 font-bold px-5 py-2.5 rounded-xl text-sm active:scale-95 transition-transform">
            <RefreshCw size={14} strokeWidth={2.5} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="bg-yellow-400 px-5 pt-6 pb-5 shrink-0">
        <h1 className="text-2xl font-black text-gray-900">All Accounts</h1>
        <p className="text-yellow-800 text-sm font-medium mt-0.5">
          {accounts.length} active account{accounts.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 px-6 text-center">
            <div className="w-[72px] h-[72px] bg-yellow-100 rounded-full flex items-center justify-center">
              <Building2 size={32} className="text-yellow-500" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-bold text-gray-700">No bank accounts yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Tap the <strong className="text-yellow-500">+</strong> button below to add one
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {accounts.map((acc, i) => {
              const [bg, fg] = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <button key={acc.id} onClick={() => setSelected(acc)}
                  className="w-full flex items-center px-5 py-4 gap-4 text-left active:bg-gray-50 transition-colors">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${bg} ${fg}`}>
                    {acc.holder_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{acc.holder_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <CreditCard size={11} className="text-gray-400 shrink-0" strokeWidth={1.8} />
                      <p className="text-sm text-gray-500 font-mono tracking-tight truncate">{acc.account_number}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{acc.bank_name} · <span className="font-mono">{acc.ifsc_code}</span></p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-t-3xl w-full pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-4 mb-4" />
            <div className="px-6 pb-2"><h3 className="text-lg font-black text-gray-900">Account Details</h3></div>
            <div className="mx-4 rounded-2xl overflow-hidden border border-gray-100 mb-4">
              {[
                { icon: Building2, label: 'Holder Name', value: selected.holder_name },
                { icon: CreditCard, label: 'Bank Name', value: selected.bank_name },
                { icon: CreditCard, label: 'Account Number', value: selected.account_number },
                { icon: Hash, label: 'IFSC Code', value: selected.ifsc_code },
                ...(selected.contact_number ? [{ icon: Phone, label: 'Contact', value: selected.contact_number }] : []),
                ...(selected.account_address ? [{ icon: MapPin, label: 'Address', value: selected.account_address }] : []),
              ].map(({ icon: Icon, label, value }, i) => (
                <div key={label} className={`flex items-center gap-3 px-4 py-3.5 ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                  <div className="w-7 h-7 bg-yellow-100 rounded-lg flex items-center justify-center shrink-0">
                    <Icon size={13} className="text-yellow-600" strokeWidth={1.8} />
                  </div>
                  <span className="text-gray-500 text-xs flex-1 mr-2">{label}</span>
                  <span className="font-bold text-gray-900 text-sm text-right break-all">{value}</span>
                </div>
              ))}
            </div>
            <div className="px-4">
              <button onClick={() => { setDeleteConfirm(selected); setSelected(null); }}
                className="w-full bg-red-50 border border-red-200 text-red-600 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                <Trash2 size={16} /> Remove This Account
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-6" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-3xl w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={26} className="text-red-500" strokeWidth={1.8} />
            </div>
            <h3 className="text-lg font-black text-gray-900 text-center">Remove Account?</h3>
            <p className="text-gray-600 text-sm text-center mt-2 font-bold">{deleteConfirm.holder_name}</p>
            <p className="text-gray-400 text-xs text-center font-mono mt-0.5 mb-4">{deleteConfirm.account_number}</p>
            <p className="text-gray-400 text-xs text-center mb-6">This account will be permanently removed from your profile.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm active:scale-[0.98] transition-transform">Cancel</button>
              <button onClick={handleDeleteConfirm} disabled={deleting} className="py-3 rounded-2xl bg-red-500 text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-60">
                {deleting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl z-50 text-center shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
