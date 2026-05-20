import { useEffect, useState } from 'react';
import { Plus, ArrowLeft, Eye, EyeOff, Ban, CheckCircle, Users, AlertTriangle, RefreshCw } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../lib/auth';

interface AppUser {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  is_banned: boolean;
  created_at: string;
}

type View = 'list' | 'create';

export default function AdminUsersScreen() {
  const { user } = useAuth();
  const [view, setView] = useState<View>('list');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ user_id: '', password: '', name: '', phone: '' });
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadUsers(); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const snap = await getDocs(
        query(collection(db, 'users'), where('created_by', '==', user!.id))
      );
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          user_id: data.user_id || '',
          name: data.name || '',
          phone: data.phone || '',
          is_banned: data.is_banned || false,
          created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as AppUser;
      });
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setUsers(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
        setError('Firestore rules are blocking reads. In Firebase Console → Firestore → Rules, set: allow read, write: if true;');
      } else {
        setError('Failed to load users: ' + msg);
      }
      console.error('AdminUsersScreen loadUsers error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.user_id.trim() || !form.password.trim() || !form.name.trim()) {
      setError('User ID, Password, and Name are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    // Check for duplicate user_id
    const existing = await getDocs(query(collection(db, 'users'), where('user_id', '==', form.user_id.trim())));
    if (!existing.empty) {
      setError('This User ID already exists. Try another.');
      setSubmitting(false);
      return;
    }
    await addDoc(collection(db, 'users'), {
      user_id: form.user_id.trim(),
      password: form.password,
      name: form.name.trim(),
      phone: form.phone.trim(),
      created_by: user!.id,
      is_banned: false,
      created_at: serverTimestamp(),
    });
    await logActivity('admin', user!.id, user!.displayId, 'user_created', 'user', null, form.user_id, { name: form.name });
    setSubmitting(false);
    setForm({ user_id: '', password: '', name: '', phone: '' });
    setView('list');
    loadUsers();
    showToast('User created successfully.');
  };

  const toggleBan = async (u: AppUser) => {
    const newBan = !u.is_banned;
    await updateDoc(doc(db, 'users', u.id), { is_banned: newBan });
    await logActivity('admin', user!.id, user!.displayId, newBan ? 'user_banned' : 'user_unbanned', 'user', u.id, u.user_id);
    loadUsers();
    showToast(`User ${newBan ? 'banned' : 'unbanned'}.`);
  };

  const Toast = () => toast ? (
    <div className="fixed bottom-24 left-4 right-4 bg-gray-800 border border-white/10 text-white text-sm px-4 py-3 rounded-2xl z-50 text-center shadow-xl">
      {toast}
    </div>
  ) : null;

  if (view === 'create') {
    return (
      <div className="flex flex-col h-full bg-[#111111]">
        <div className="px-5 py-4 flex items-center gap-3 border-b border-white/[0.06] shrink-0">
          <button onClick={() => { setView('list'); setError(''); }} className="w-9 h-9 bg-white/[0.06] rounded-xl flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft size={17} className="text-gray-300" />
          </button>
          <h2 className="text-lg font-black text-white">Create New User</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-24">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          {([
            { label: 'User ID *', key: 'user_id', placeholder: 'e.g. aman1322', hint: 'Used to login' },
            { label: 'Full Name *', key: 'name', placeholder: 'Enter full name' },
            { label: 'Phone Number', key: 'phone', placeholder: 'Enter phone number', type: 'tel' },
          ] as { label: string; key: string; placeholder: string; hint?: string; type?: string }[]).map(f => (
            <div key={f.key} className="mb-4">
              <label className="block text-gray-300 text-sm font-bold mb-1.5">{f.label}</label>
              {f.hint && <p className="text-gray-600 text-xs mb-1.5">{f.hint}</p>}
              <input
                type={f.type || 'text'}
                placeholder={f.placeholder}
                value={form[f.key as keyof typeof form]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full bg-white/[0.06] border border-white/[0.1] text-white px-4 py-3.5 rounded-xl text-sm outline-none focus:border-yellow-400 placeholder-gray-600 transition-colors"
              />
            </div>
          ))}

          <div className="mb-6">
            <label className="block text-gray-300 text-sm font-bold mb-1.5">Password *</label>
            <div className="flex items-center bg-white/[0.06] border border-white/[0.1] rounded-xl px-4 focus-within:border-yellow-400 transition-colors">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="e.g. Aman55"
                value={form.password}
                onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                className="flex-1 bg-transparent text-white py-3.5 text-sm outline-none placeholder-gray-600"
              />
              <button onClick={() => setShowPw(!showPw)} className="p-1 active:opacity-70">
                {showPw ? <EyeOff size={16} className="text-gray-500" /> : <Eye size={16} className="text-gray-500" />}
              </button>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={submitting}
            className="w-full bg-yellow-400 text-gray-900 font-black py-4 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-60 shadow-lg shadow-yellow-900/30"
          >
            {submitting ? 'Creating...' : 'Create User'}
          </button>
        </div>
        <Toast />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#111111]">
      <div className="px-5 pt-8 pb-5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-black text-white">Users</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {loading ? '...' : `${users.length} user${users.length !== 1 ? 's' : ''} created by you`}
          </p>
        </div>
        <button
          onClick={() => setView('create')}
          className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center active:scale-95 transition-transform shadow-lg shadow-yellow-900/30"
        >
          <Plus size={20} className="text-gray-900" strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="divide-y divide-white/[0.04]">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 px-5 py-4">
                <div className="w-11 h-11 bg-white/[0.06] rounded-full animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-white/[0.06] rounded animate-pulse" />
                  <div className="h-3 w-20 bg-white/[0.04] rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-52 text-center px-6 gap-3">
            <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-400" strokeWidth={1.8} />
            </div>
            <p className="text-red-400 text-sm font-bold">Firestore Access Error</p>
            <p className="text-gray-500 text-xs leading-relaxed">{error}</p>
            <button onClick={loadUsers} className="flex items-center gap-2 bg-yellow-400 text-gray-900 font-bold px-4 py-2 rounded-xl text-sm active:scale-95 transition-transform">
              <RefreshCw size={13} strokeWidth={2.5} /> Retry
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-center px-6">
            <div className="w-16 h-16 bg-white/[0.04] rounded-full flex items-center justify-center mb-4">
              <Users size={28} className="text-gray-600" strokeWidth={1.5} />
            </div>
            <p className="text-gray-400 font-bold text-sm">No users created yet</p>
            <p className="text-gray-600 text-xs mt-1">Tap + to create the first user</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {users.map(u => (
              <div key={u.id} className="flex items-center px-5 py-4 gap-3">
                <div className="w-11 h-11 bg-yellow-400/12 border border-yellow-400/20 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-yellow-400 font-black text-sm">
                    {u.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold truncate">{u.name}</p>
                  <p className="text-gray-500 text-xs">ID: {u.user_id}</p>
                  {u.is_banned && (
                    <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-medium">
                      Banned
                    </span>
                  )}
                </div>
                <button
                  onClick={() => toggleBan(u)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform border ${
                    u.is_banned
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                      : 'bg-red-500/10 text-red-400 border-red-500/25'
                  }`}
                >
                  {u.is_banned ? <CheckCircle size={15} strokeWidth={2} /> : <Ban size={15} strokeWidth={2} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <Toast />
    </div>
  );
}
