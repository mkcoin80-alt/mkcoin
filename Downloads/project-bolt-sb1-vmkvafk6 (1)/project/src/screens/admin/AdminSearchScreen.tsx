import { useState } from 'react';
import { Search, X, ChevronRight, Plus, ArrowLeft, User, CreditCard, Building2, Hash, Phone, MapPin, IndianRupee } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, getDoc, addDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../lib/auth';

interface AccountResult {
  id: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  holder_name: string;
  contact_number: string;
  account_address: string;
  is_active: boolean;
  user_id: string;
  user_display_id: string;
  user_name: string;
}

type View = 'search' | 'detail' | 'addHistory';

function DarkInput({ label, value, onChange, placeholder, type = 'text', hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; type?: string; hint?: string;
}) {
  return (
    <div className="mb-4">
      <label className="block text-gray-300 text-sm font-bold mb-1.5">{label}</label>
      {hint && <p className="text-gray-600 text-xs mb-1.5">{hint}</p>}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/[0.06] border border-white/[0.1] text-white px-4 py-3.5 rounded-xl text-sm outline-none focus:border-yellow-400 placeholder-gray-600 transition-colors"
      />
    </div>
  );
}

export default function AdminSearchScreen() {
  const { user } = useAuth();
  const [query4, setQuery4] = useState('');
  const [results, setResults] = useState<AccountResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>('search');
  const [selected, setSelected] = useState<AccountResult | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleSearch = async () => {
    const q = query4.trim();
    if (q.length !== 4 || !/^\d{4}$/.test(q)) {
      showToast('Please enter exactly 4 digits.');
      return;
    }
    setLoading(true);
    setSearched(true);

    // Fetch all active bank accounts, then filter by last 4 digits
    const snap = await getDocs(query(collection(db, 'bank_accounts'), where('is_active', '==', true)));
    const all = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as AccountResult & Record<string, unknown>))
      .filter(a => (a.account_number as string).endsWith(q));

    // Resolve linked users
    const enriched: AccountResult[] = await Promise.all(all.map(async (a) => {
      let user_name = '';
      let user_display_id = '';
      if (a.user_id) {
        try {
          const uSnap = await getDoc(doc(db, 'users', a.user_id));
          if (uSnap.exists()) {
            const ud = uSnap.data();
            user_name = ud.name || '';
            user_display_id = ud.user_id || '';
          }
        } catch { /* ignore */ }
      }
      return { ...a, user_name, user_display_id } as AccountResult;
    }));

    setResults(enriched);
    setLoading(false);
  };

  const handleAddHistory = async () => {
    const num = Number(amount);
    if (!num || num <= 0) { showToast('Enter a valid amount.'); return; }
    if (!selected?.user_id) { showToast('No user linked to this account.'); return; }
    setSubmitting(true);
    try {
      const earning = Math.round(num * 0.25 * 100) / 100;
      const docRef = await addDoc(collection(db, 'transactions'), {
        user_id: selected.user_id,
        bank_account_id: selected.id,
        amount: num,
        earning,
        type: 'success',
        status: 'success',
        description: description.trim(),
        created_by_admin: user!.id,
        created_at: serverTimestamp(),
      });
      await logActivity('admin', user!.id, user!.displayId, 'transaction_added', 'user', selected.user_id, selected.user_display_id, { amount: num, earning, transaction_id: docRef.id });
      setAmount('');
      setDescription('');
      setView('detail');
      showToast(`Transaction added! User earns ₹${earning.toLocaleString('en-IN')}`);
    } catch (e) {
      console.error('Error adding transaction:', e);
      showToast('Failed to add transaction. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const Toast = () => toast ? (
    <div className="fixed bottom-24 left-4 right-4 bg-gray-800 border border-white/10 text-white text-sm px-4 py-3 rounded-2xl z-50 text-center shadow-xl">
      {toast}
    </div>
  ) : null;

  if (view === 'addHistory' && selected) {
    return (
      <div className="flex flex-col h-full bg-[#111111]">
        <div className="px-5 py-4 flex items-center gap-3 border-b border-white/[0.06] shrink-0">
          <button onClick={() => setView('detail')} className="w-9 h-9 bg-white/[0.06] rounded-xl flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft size={17} className="text-gray-300" />
          </button>
          <h2 className="text-lg font-black text-white">Add Success History</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-24">
          <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-2xl p-4 mb-5">
            <p className="text-yellow-400 text-xs font-bold uppercase tracking-wide mb-2">Account</p>
            <p className="text-white font-black">{selected.holder_name}</p>
            <p className="text-gray-400 text-sm font-mono mt-0.5">{selected.account_number}</p>
            <p className="text-gray-500 text-xs mt-0.5">{selected.bank_name} · {selected.ifsc_code}</p>
            {selected.user_name && (
              <p className="text-gray-500 text-xs mt-1.5 border-t border-yellow-400/15 pt-1.5">
                User: <span className="text-yellow-400 font-bold">{selected.user_name}</span> ({selected.user_display_id})
              </p>
            )}
          </div>

          <DarkInput label="Amount (₹) *" value={amount} onChange={setAmount} placeholder="Enter transaction amount" type="number" />
          {Number(amount) > 0 && (
            <div className="flex items-center gap-2 -mt-2 mb-4 px-1">
              <IndianRupee size={12} className="text-yellow-400" />
              <p className="text-yellow-400 text-xs font-bold">
                User earns ₹{(Number(amount) * 0.25).toLocaleString('en-IN')} (25% commission)
              </p>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-gray-300 text-sm font-bold mb-1.5">Description (optional)</label>
            <textarea
              placeholder="Add a note..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-white/[0.06] border border-white/[0.1] text-white px-4 py-3 rounded-xl text-sm outline-none focus:border-yellow-400 placeholder-gray-600 resize-none transition-colors"
            />
          </div>

          <button
            onClick={handleAddHistory}
            disabled={submitting}
            className="w-full bg-yellow-400 text-gray-900 font-black py-4 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-60 shadow-lg shadow-yellow-900/30"
          >
            {submitting ? 'Adding...' : 'Add Success History'}
          </button>
        </div>
        <Toast />
      </div>
    );
  }

  if (view === 'detail' && selected) {
    const details = [
      { icon: User, label: 'Holder Name', value: selected.holder_name },
      { icon: CreditCard, label: 'Account Number', value: selected.account_number },
      { icon: Hash, label: 'IFSC Code', value: selected.ifsc_code },
      { icon: Building2, label: 'Bank Name', value: selected.bank_name },
      { icon: Phone, label: 'Contact', value: selected.contact_number || '—' },
      { icon: MapPin, label: 'Address', value: selected.account_address || '—' },
    ] as { icon: React.ElementType; label: string; value: string }[];

    return (
      <div className="flex flex-col h-full bg-[#111111]">
        <div className="px-5 py-4 flex items-center gap-3 border-b border-white/[0.06] shrink-0">
          <button onClick={() => setView('search')} className="w-9 h-9 bg-white/[0.06] rounded-xl flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft size={17} className="text-gray-300" />
          </button>
          <h2 className="text-lg font-black text-white">Account Details</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
          <div className="bg-white/[0.04] rounded-2xl border border-white/[0.07] overflow-hidden mb-4">
            {details.map(({ icon: Icon, label, value }, idx) => (
              <div key={label} className={`flex items-center gap-3 px-4 py-3.5 ${idx % 2 === 0 ? '' : 'bg-white/[0.02]'} ${idx < details.length - 1 ? 'border-b border-white/[0.05]' : ''}`}>
                <div className="w-7 h-7 bg-yellow-400/10 rounded-lg flex items-center justify-center shrink-0">
                  <Icon size={13} className="text-yellow-400" strokeWidth={1.8} />
                </div>
                <span className="text-gray-500 text-xs flex-1">{label}</span>
                <span className="text-white font-bold text-sm text-right break-all">{value}</span>
              </div>
            ))}
            {selected.user_name && (
              <div className="flex items-center gap-3 px-4 py-3.5 bg-yellow-400/5 border-t border-yellow-400/15">
                <div className="w-7 h-7 bg-yellow-400/15 rounded-lg flex items-center justify-center shrink-0">
                  <User size={13} className="text-yellow-400" strokeWidth={1.8} />
                </div>
                <span className="text-gray-500 text-xs flex-1">Linked User</span>
                <span className="text-yellow-400 font-bold text-sm">{selected.user_name} ({selected.user_display_id})</span>
              </div>
            )}
          </div>

          <button
            onClick={() => setView('addHistory')}
            className="w-full bg-yellow-400 text-gray-900 font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-yellow-900/30"
          >
            <Plus size={18} strokeWidth={2.5} />
            Add Success History
          </button>
        </div>
        <Toast />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#111111]">
      <div className="px-5 pt-8 pb-5 shrink-0">
        <h1 className="text-2xl font-black text-white">Search Accounts</h1>
        <p className="text-gray-500 text-sm mt-0.5">Enter last 4 digits of account number</p>
      </div>

      <div className="px-4 pb-3 shrink-0">
        <div className="flex gap-2">
          <div className="flex-1 flex items-center bg-white/[0.06] rounded-2xl px-4 gap-3 border border-white/[0.1] focus-within:border-yellow-400 transition-colors">
            <Search size={17} className="text-gray-500 shrink-0" strokeWidth={1.8} />
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="Last 4 digits..."
              value={query4}
              onChange={e => setQuery4(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="flex-1 bg-transparent text-white py-3.5 text-sm outline-none placeholder-gray-600"
            />
            {query4 && (
              <button onClick={() => { setQuery4(''); setResults([]); setSearched(false); }} className="active:opacity-70">
                <X size={15} className="text-gray-500" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            className="bg-yellow-400 text-gray-900 font-black px-5 rounded-2xl active:scale-95 transition-transform"
          >
            Go
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {loading && (
          <div className="space-y-3 pt-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white/[0.04] rounded-2xl p-4 h-20 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Search size={32} className="text-gray-700 mb-3" strokeWidth={1.5} />
            <p className="text-gray-500 text-sm">No accounts found ending in <strong className="text-gray-300">{query4}</strong></p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="pt-2">
            <p className="text-gray-600 text-xs font-medium mb-3 px-1">
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </p>
            <div className="space-y-2">
              {results.map(r => (
                <button
                  key={r.id}
                  onClick={() => { setSelected(r); setView('detail'); }}
                  className="w-full bg-white/[0.04] rounded-2xl p-4 flex items-center gap-3 text-left border border-white/[0.07] active:scale-[0.99] transition-transform"
                >
                  <div className="w-11 h-11 bg-yellow-400/12 rounded-full flex items-center justify-center shrink-0 border border-yellow-400/20">
                    <span className="text-yellow-400 font-black text-sm">
                      {r.holder_name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold truncate">{r.holder_name}</p>
                    <p className="text-gray-400 text-sm font-mono">···· {r.account_number.slice(-4)}</p>
                    {r.user_name && <p className="text-gray-600 text-xs mt-0.5">{r.user_name}</p>}
                  </div>
                  <ChevronRight size={15} className="text-gray-600 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {!searched && !loading && (
          <div className="flex flex-col items-center justify-center h-52 text-center">
            <div className="w-16 h-16 bg-white/[0.04] rounded-full flex items-center justify-center mb-4">
              <CreditCard size={28} className="text-gray-600" strokeWidth={1.5} />
            </div>
            <p className="text-gray-500 text-sm font-medium">Enter 4 digits to search</p>
            <p className="text-gray-700 text-xs mt-1">Find accounts by last 4 digits</p>
          </div>
        )}
      </div>

      <Toast />
    </div>
  );
}
