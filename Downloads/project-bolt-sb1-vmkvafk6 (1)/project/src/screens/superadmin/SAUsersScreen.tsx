import { useEffect, useState } from 'react';
import { Plus, ArrowLeft, Eye, EyeOff, Ban, CheckCircle, ChevronRight, Key, Users, Phone, Calendar, X, AlertTriangle, RefreshCw } from 'lucide-react';
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

interface Admin {
  id: string;
  admin_id: string;
  name: string;
  phone: string;
  is_banned: boolean;
  created_at: string;
}

type EntityTab = 'users' | 'admins';
type View = 'list' | 'createUser' | 'createAdmin' | 'editUser' | 'resetPw';

const Toast = ({ msg }: { msg: string }) => msg ? (
  <div className="fixed bottom-24 left-4 right-4 bg-gray-800 border border-white/10 text-white text-sm px-4 py-3 rounded-2xl z-50 text-center shadow-xl">
    {msg}
  </div>
) : null;

export default function SAUsersScreen() {
  const { user } = useAuth();
  const [entityTab, setEntityTab] = useState<EntityTab>('users');
  const [view, setView] = useState<View>('list');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ id: '', password: '', name: '', phone: '' });
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [detailUser, setDetailUser] = useState<AppUser | null>(null);
  const [newPw, setNewPw] = useState('');

  useEffect(() => { loadData(); }, [entityTab]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      if (entityTab === 'users') {
        const snap = await getDocs(collection(db, 'users'));
        const list = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            user_id: data.user_id,
            name: data.name,
            phone: data.phone || '',
            is_banned: data.is_banned || false,
            created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
          } as AppUser;
        });
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setUsers(list);
      } else {
        const snap = await getDocs(collection(db, 'admins'));
        const list = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            admin_id: data.admin_id,
            name: data.name,
            phone: data.phone || '',
            is_banned: data.is_banned || false,
            created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
          } as Admin;
        });
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setAdmins(list);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
        setError('Firestore rules are blocking reads. In Firebase Console → Firestore → Rules, set: allow read, write: if true;');
      } else {
        setError('Failed to load data: ' + msg);
      }
      console.error('SAUsersScreen loadData error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.id.trim() || !form.password.trim() || !form.name.trim()) {
      setError('ID, Password, and Name are required.'); return;
    }
    setSubmitting(true); setError('');
    const isUser = view === 'createUser';
    const colName = isUser ? 'users' : 'admins';
    const idField = isUser ? 'user_id' : 'admin_id';
    // Check duplicate
    const existing = await getDocs(query(collection(db, colName), where(idField, '==', form.id.trim())));
    if (!existing.empty) {
      setError('This ID already exists.');
      setSubmitting(false); return;
    }
    await addDoc(collection(db, colName), {
      [idField]: form.id.trim(),
      password: form.password,
      name: form.name.trim(),
      phone: form.phone.trim(),
      is_banned: false,
      ...(isUser ? {} : { created_by: user!.id }),
      created_at: serverTimestamp(),
    });
    await logActivity('superadmin', user!.id, user!.displayId, isUser ? 'user_created' : 'admin_created',
      isUser ? 'user' : 'admin', null, form.id, { name: form.name });
    setSubmitting(false);
    setForm({ id: '', password: '', name: '', phone: '' });
    setView('list');
    loadData();
    showToast(`${isUser ? 'User' : 'Admin'} created.`);
  };

  const toggleBan = async (item: AppUser | Admin, type: EntityTab) => {
    const newBan = !item.is_banned;
    const colName = type === 'users' ? 'users' : 'admins';
    await updateDoc(doc(db, colName, item.id), { is_banned: newBan });
    const displayId = 'user_id' in item ? item.user_id : item.admin_id;
    await logActivity('superadmin', user!.id, user!.displayId,
      newBan ? `${type.slice(0, -1)}_banned` : `${type.slice(0, -1)}_unbanned`,
      type.slice(0, -1), item.id, displayId);
    loadData();
    showToast(`${type === 'users' ? 'User' : 'Admin'} ${newBan ? 'banned' : 'unbanned'}.`);
  };

  const handleResetPw = async () => {
    if (!newPw.trim() || !selectedUser) { showToast('Enter a new password.'); return; }
    await updateDoc(doc(db, 'users', selectedUser.id), { password: newPw.trim() });
    await logActivity('superadmin', user!.id, user!.displayId, 'password_reset', 'user', selectedUser.id, selectedUser.user_id);
    showToast('Password reset.');
    setView('list'); setNewPw(''); setSelectedUser(null);
  };

  const handleEditUser = async () => {
    if (!selectedUser || !form.name.trim()) { showToast('Name is required.'); return; }
    await updateDoc(doc(db, 'users', selectedUser.id), { name: form.name.trim(), phone: form.phone.trim() });
    await logActivity('superadmin', user!.id, user!.displayId, 'user_edited', 'user', selectedUser.id, selectedUser.user_id);
    showToast('User updated.'); setView('list'); loadData();
  };

  const backToList = () => { setView('list'); setError(''); setSelectedUser(null); };

  const darkInput = (label: string, value: string, onChange: (v: string) => void, placeholder: string, type = 'text') => (
    <div className="mb-4">
      <label className="block text-gray-300 text-sm font-bold mb-1.5">{label}</label>
      <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-white/[0.06] border border-white/[0.1] text-white px-4 py-3.5 rounded-xl text-sm outline-none focus:border-yellow-400 placeholder-gray-600 transition-colors" />
    </div>
  );

  if (view === 'resetPw' && selectedUser) {
    return (
      <div className="flex flex-col h-full bg-[#111111]">
        <div className="px-5 py-4 flex items-center gap-3 border-b border-white/[0.06] shrink-0">
          <button onClick={backToList} className="w-9 h-9 bg-white/[0.06] rounded-xl flex items-center justify-center active:scale-95 transition-transform"><ArrowLeft size={17} className="text-gray-300" /></button>
          <h2 className="text-lg font-black text-white">Reset Password</h2>
        </div>
        <div className="px-5 pt-5">
          <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-3.5 mb-5">
            <p className="text-gray-400 text-sm">Resetting for: <strong className="text-white">{selectedUser.name} ({selectedUser.user_id})</strong></p>
          </div>
          {darkInput('New Password', newPw, setNewPw, 'Enter new password')}
          <button onClick={handleResetPw}
            className="w-full bg-yellow-400 text-gray-900 font-black py-4 rounded-2xl active:scale-[0.98] transition-transform mt-2 shadow-lg shadow-yellow-900/30">
            Reset Password
          </button>
        </div>
        <Toast msg={toast} />
      </div>
    );
  }

  if (view === 'editUser' && selectedUser) {
    return (
      <div className="flex flex-col h-full bg-[#111111]">
        <div className="px-5 py-4 flex items-center gap-3 border-b border-white/[0.06] shrink-0">
          <button onClick={backToList} className="w-9 h-9 bg-white/[0.06] rounded-xl flex items-center justify-center active:scale-95 transition-transform"><ArrowLeft size={17} className="text-gray-300" /></button>
          <h2 className="text-lg font-black text-white">Edit User</h2>
        </div>
        <div className="px-5 pt-5">
          {darkInput('Full Name', form.name, v => setForm(f => ({ ...f, name: v })), 'Full name')}
          {darkInput('Phone Number', form.phone, v => setForm(f => ({ ...f, phone: v })), 'Phone number', 'tel')}
          <button onClick={handleEditUser}
            className="w-full bg-yellow-400 text-gray-900 font-black py-4 rounded-2xl active:scale-[0.98] transition-transform mt-2 shadow-lg shadow-yellow-900/30">
            Save Changes
          </button>
        </div>
        <Toast msg={toast} />
      </div>
    );
  }

  if (view === 'createUser' || view === 'createAdmin') {
    const isUser = view === 'createUser';
    return (
      <div className="flex flex-col h-full bg-[#111111]">
        <div className="px-5 py-4 flex items-center gap-3 border-b border-white/[0.06] shrink-0">
          <button onClick={backToList} className="w-9 h-9 bg-white/[0.06] rounded-xl flex items-center justify-center active:scale-95 transition-transform"><ArrowLeft size={17} className="text-gray-300" /></button>
          <h2 className="text-lg font-black text-white">Create {isUser ? 'User' : 'Admin'}</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-8">
          {error && <div className="bg-red-500/10 border border-red-500/25 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}
          {darkInput(`${isUser ? 'User' : 'Admin'} ID *`, form.id, v => setForm(f => ({ ...f, id: v })), isUser ? 'e.g. aman1322' : 'e.g. admin001')}
          {darkInput('Full Name *', form.name, v => setForm(f => ({ ...f, name: v })), 'Enter full name')}
          {darkInput('Phone Number', form.phone, v => setForm(f => ({ ...f, phone: v })), 'Enter phone number', 'tel')}
          <div className="mb-6">
            <label className="block text-gray-300 text-sm font-bold mb-1.5">Password *</label>
            <div className="flex items-center bg-white/[0.06] border border-white/[0.1] rounded-xl px-4 focus-within:border-yellow-400 transition-colors">
              <input type={showPw ? 'text' : 'password'} placeholder="Enter password" value={form.password}
                onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                className="flex-1 bg-transparent text-white py-3.5 text-sm outline-none placeholder-gray-600" />
              <button onClick={() => setShowPw(v => !v)} className="p-1 active:opacity-70">
                {showPw ? <EyeOff size={16} className="text-gray-500" /> : <Eye size={16} className="text-gray-500" />}
              </button>
            </div>
          </div>
          <button onClick={handleCreate} disabled={submitting}
            className="w-full bg-yellow-400 text-gray-900 font-black py-4 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-60 shadow-lg shadow-yellow-900/30">
            {submitting ? 'Creating...' : `Create ${isUser ? 'User' : 'Admin'}`}
          </button>
        </div>
        <Toast msg={toast} />
      </div>
    );
  }

  const listData = entityTab === 'users' ? users : admins;

  return (
    <div className="flex flex-col h-full bg-[#111111]">
      <div className="px-5 pt-8 pb-0 flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-black text-white">Accounts</h1>
        <button
          onClick={() => { setForm({ id: '', password: '', name: '', phone: '' }); setView(entityTab === 'users' ? 'createUser' : 'createAdmin'); }}
          className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center active:scale-95 transition-transform shadow-lg shadow-yellow-900/30"
        >
          <Plus size={20} className="text-gray-900" strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex gap-2 px-5 py-4 shrink-0">
        {(['users', 'admins'] as EntityTab[]).map(t => (
          <button key={t} onClick={() => setEntityTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-bold capitalize transition-colors ${entityTab === t ? 'bg-yellow-400 text-gray-900' : 'bg-white/[0.06] text-gray-400'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
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
            <button onClick={loadData} className="flex items-center gap-2 bg-yellow-400 text-gray-900 font-bold px-4 py-2 rounded-xl text-sm active:scale-95 transition-transform">
              <RefreshCw size={13} strokeWidth={2.5} /> Retry
            </button>
          </div>
        ) : listData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-6">
            <div className="w-14 h-14 bg-white/[0.04] rounded-full flex items-center justify-center mb-3">
              <Users size={26} className="text-gray-600" strokeWidth={1.5} />
            </div>
            <p className="text-gray-500 text-sm">No {entityTab} yet. Tap + to create.</p>
          </div>
        ) : entityTab === 'users' ? (
          <div className="divide-y divide-white/[0.04]">
            {users.map(u => (
              <div key={u.id} className="flex items-center px-5 py-4 gap-2">
                <button onClick={() => setDetailUser(u)} className="w-11 h-11 bg-yellow-400/12 border border-yellow-400/20 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                  <span className="text-yellow-400 font-black text-sm">{u.name.charAt(0).toUpperCase()}</span>
                </button>
                <button onClick={() => setDetailUser(u)} className="flex-1 min-w-0 mr-1 text-left">
                  <p className="text-white font-bold truncate text-sm">{u.name}</p>
                  <p className="text-gray-500 text-xs">{u.user_id}</p>
                  {u.is_banned && <span className="text-xs bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full">Banned</span>}
                </button>
                <button onClick={() => { setSelectedUser(u); setView('resetPw'); }}
                  className="w-8 h-8 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                  <Key size={13} strokeWidth={2} />
                </button>
                <button onClick={() => { setSelectedUser(u); setForm({ id: u.user_id, name: u.name, phone: u.phone, password: '' }); setView('editUser'); }}
                  className="w-8 h-8 bg-white/[0.06] text-gray-400 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                  <ChevronRight size={14} strokeWidth={2} />
                </button>
                <button onClick={() => toggleBan(u, 'users')}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform border ${u.is_banned ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  {u.is_banned ? <CheckCircle size={13} strokeWidth={2} /> : <Ban size={13} strokeWidth={2} />}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {admins.map(a => (
              <div key={a.id} className="flex items-center px-5 py-4 gap-3">
                <div className="w-11 h-11 bg-blue-400/12 border border-blue-400/20 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-blue-400 font-black text-sm">{a.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold truncate">{a.name}</p>
                  <p className="text-gray-500 text-xs">{a.admin_id}</p>
                  {a.is_banned && <span className="text-xs bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full">Banned</span>}
                </div>
                <button onClick={() => toggleBan(a, 'admins')}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform border ${a.is_banned ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  {a.is_banned ? <CheckCircle size={13} strokeWidth={2} /> : <Ban size={13} strokeWidth={2} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {detailUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setDetailUser(null)}>
          <div className="bg-[#1a1a1a] rounded-t-3xl w-full pb-8 slide-up border-t border-white/[0.08]" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-4 mb-4" />
            <div className="flex items-center justify-between px-6 mb-4">
              <h3 className="text-lg font-black text-white">User Details</h3>
              <button onClick={() => setDetailUser(null)} className="w-8 h-8 bg-white/[0.06] rounded-full flex items-center justify-center">
                <X size={15} className="text-gray-400" />
              </button>
            </div>
            <div className="mx-4 rounded-2xl overflow-hidden border border-white/[0.08] mb-4">
              {[
                { icon: Users, label: 'Full Name', value: detailUser.name },
                { icon: Key, label: 'User ID', value: detailUser.user_id },
                ...(detailUser.phone ? [{ icon: Phone, label: 'Phone', value: detailUser.phone }] : []),
                { icon: Calendar, label: 'Joined', value: new Date(detailUser.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) },
                { icon: CheckCircle, label: 'Status', value: detailUser.is_banned ? 'Banned' : 'Active' },
              ].map(({ icon: Icon, label, value }, i) => (
                <div key={label} className={`flex items-center gap-3 px-4 py-3.5 ${i % 2 === 0 ? 'bg-white/[0.03]' : ''}`}>
                  <div className="w-7 h-7 bg-yellow-400/10 rounded-lg flex items-center justify-center shrink-0">
                    <Icon size={13} className="text-yellow-400" strokeWidth={1.8} />
                  </div>
                  <span className="text-gray-500 text-xs flex-1">{label}</span>
                  <span className={`font-bold text-sm ${label === 'Status' && detailUser.is_banned ? 'text-red-400' : 'text-white'}`}>{value}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 px-4">
              <button
                onClick={() => { setSelectedUser(detailUser); setDetailUser(null); setView('resetPw'); }}
                className="flex-1 py-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold text-sm rounded-2xl flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
              >
                <Key size={14} strokeWidth={2} /> Reset PW
              </button>
              <button
                onClick={() => { setSelectedUser(detailUser); setForm({ id: detailUser.user_id, name: detailUser.name, phone: detailUser.phone, password: '' }); setDetailUser(null); setView('editUser'); }}
                className="flex-1 py-3 bg-white/[0.06] text-gray-300 font-bold text-sm rounded-2xl flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
              >
                <ChevronRight size={14} strokeWidth={2} /> Edit
              </button>
              <button
                onClick={() => { toggleBan(detailUser, 'users'); setDetailUser(null); }}
                className={`flex-1 py-3 font-bold text-sm rounded-2xl flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform border ${detailUser.is_banned ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}
              >
                {detailUser.is_banned ? <><CheckCircle size={13} strokeWidth={2} /> Unban</> : <><Ban size={13} strokeWidth={2} /> Ban</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast msg={toast} />
    </div>
  );
}
