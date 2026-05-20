import { useEffect, useState } from 'react';
import { QrCode, Bell, Activity, Trash2, ArrowLeft, ChevronRight, Send, CheckCircle, AlertTriangle } from 'lucide-react';
import { db, storage } from '../../lib/firebase';
import { collection, getDocs, getDoc, addDoc, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../lib/auth';

interface ActivityLog {
  id: string;
  actor_type: string;
  actor_display_id: string;
  action: string;
  target_type: string;
  target_display_id: string;
  created_at: string;
}

interface History {
  id: string;
  amount: number;
  earning: number;
  created_at: string;
  user_name: string;
  user_display_id: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

type View = 'menu' | 'qr' | 'notifications' | 'logs' | 'histories';

export default function SASettingsScreen() {
  const { user } = useAuth();
  const [view, setView] = useState<View>('menu');
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [currentQr, setCurrentQr] = useState('');
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [histories, setHistories] = useState<History[]>([]);
  const [sentNotifs, setSentNotifs] = useState<Notification[]>([]);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMsg, setNotifMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [notifSent, setNotifSent] = useState(false);
  const [loadError, setLoadError] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    setLoadError('');
    if (view === 'qr') loadQr();
    if (view === 'logs') loadLogs();
    if (view === 'histories') loadHistories();
    if (view === 'notifications') loadSentNotifs();
  }, [view]);

  const surfaceError = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
      setLoadError('Firestore rules are blocking reads. In Firebase Console → Firestore → Rules, set: allow read, write: if true;');
    } else {
      setLoadError('Failed to load data: ' + msg);
    }
  };

  const loadQr = async () => {
    try {
      const settingsSnap = await getDoc(doc(db, 'settings', 'qr_code'));
      if (settingsSnap.exists()) {
        setCurrentQr(settingsSnap.data().image_url || settingsSnap.data().qr_image_url || '');
      }
    } catch (e) { surfaceError(e); console.error('Error loading QR:', e); }
  };

  const loadLogs = async () => {
    try {
      const snap = await getDocs(collection(db, 'activity_logs'));
      const sorted = snap.docs.sort((a, b) => {
        const ta = a.data().created_at?.toDate?.()?.getTime() || 0;
        const tb = b.data().created_at?.toDate?.()?.getTime() || 0;
        return tb - ta;
      });
      setLogs(sorted.slice(0, 100).map(d => {
        const data = d.data();
        return {
          id: d.id,
          actor_type: data.actor_type,
          actor_display_id: data.actor_display_id,
          action: data.action,
          target_type: data.target_type || '',
          target_display_id: data.target_display_id || '',
          created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        };
      }));
    } catch (e) { surfaceError(e); console.error('Error loading logs:', e); }
  };

  const loadHistories = async () => {
    try {
      const snap = await getDocs(collection(db, 'transactions'));
      const items: History[] = await Promise.all(
        snap.docs.map(async d => {
          const data = d.data();
          let user_name = '';
          let user_display_id = '';
          if (data.user_id) {
            try {
              const uSnap = await getDoc(doc(db, 'users', data.user_id));
              if (uSnap.exists()) {
                user_name = uSnap.data().name || '';
                user_display_id = uSnap.data().user_id || '';
              }
            } catch { /* ignore */ }
          }
          return {
            id: d.id,
            amount: data.amount,
            earning: data.earning,
            created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
            user_name,
            user_display_id,
          };
        })
      );
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setHistories(items);
    } catch (e) { surfaceError(e); console.error('Error loading transactions:', e); }
  };

  const loadSentNotifs = async () => {
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
      setSentNotifs(notifs);
    } catch (e) { surfaceError(e); console.error('Error loading notifications:', e); }
  };

  const handleSaveQr = async () => {
    if (!qrFile) { showToast('Select an image file.'); return; }
    setSubmitting(true);
    try {
      // Upload to fixed path so it always overwrites the same file
      const storageRef = ref(storage, 'qr_codes/main_qr.jpg');
      await uploadBytes(storageRef, qrFile);
      const downloadUrl = await getDownloadURL(storageRef);

      // Save canonical document at settings/qr_code
      await setDoc(doc(db, 'settings', 'qr_code'), {
        image_url: downloadUrl,
        updated_at: serverTimestamp(),
      });

      await logActivity('superadmin', user!.id, user!.displayId, 'qr_uploaded', 'settings');
      setCurrentQr(downloadUrl);
      setQrFile(null);
      showToast('QR uploaded successfully.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('QR upload error:', e);
      if (msg.includes('unauthorized') || msg.includes('PERMISSION_DENIED') || msg.includes('permission')) {
        showToast('Upload blocked. Set Firebase Storage rules to allow read, write: if true;');
      } else {
        showToast('Upload failed: ' + msg.slice(0, 80));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendNotif = async () => {
    if (!notifTitle.trim() || !notifMsg.trim()) { showToast('Title and message are required.'); return; }
    setSubmitting(true);
    await addDoc(collection(db, 'notifications'), {
      title: notifTitle.trim(),
      message: notifMsg.trim(),
      created_by: user!.id,
      created_at: serverTimestamp(),
    });
    await logActivity('superadmin', user!.id, user!.displayId, 'notification_sent', 'notification', null, '', { title: notifTitle });
    setNotifTitle(''); setNotifMsg('');
    setSubmitting(false);
    setNotifSent(true);
    setTimeout(() => setNotifSent(false), 2000);
    showToast('Notification sent to all users.');
    loadSentNotifs();
  };

  const handleDeleteHistory = async (id: string) => {
    if (!confirm('Delete this history permanently?')) return;
    await deleteDoc(doc(db, 'transactions', id));
    await logActivity('superadmin', user!.id, user!.displayId, 'history_deleted', 'history', id);
    loadHistories();
    showToast('History deleted.');
  };

  const handleDeleteNotif = async (id: string) => {
    await deleteDoc(doc(db, 'notifications', id));
    setSentNotifs(prev => prev.filter(n => n.id !== id));
    showToast('Notification deleted.');
  };

  const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
  const fmtShort = (d: string) =>
    new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const SubHeader = ({ title, icon: Icon }: { title: string; icon: React.ElementType }) => (
    <div className="px-5 py-4 flex items-center gap-3 border-b border-white/[0.06] shrink-0">
      <button onClick={() => setView('menu')} className="w-9 h-9 bg-white/[0.06] rounded-xl flex items-center justify-center active:scale-95 transition-transform">
        <ArrowLeft size={17} className="text-gray-300" />
      </button>
      <div className="w-8 h-8 bg-yellow-400/10 rounded-lg flex items-center justify-center">
        <Icon size={16} className="text-yellow-400" strokeWidth={1.8} />
      </div>
      <h2 className="text-lg font-black text-white">{title}</h2>
    </div>
  );

  const darkInput = (label: string, value: string, onChange: (v: string) => void, placeholder: string, type = 'text') => (
    <div className="mb-4">
      <label className="block text-gray-300 text-sm font-bold mb-1.5">{label}</label>
      <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-white/[0.06] border border-white/[0.1] text-white px-4 py-3.5 rounded-xl text-sm outline-none focus:border-yellow-400 placeholder-gray-600 transition-colors" />
    </div>
  );

  const Toast = () => toast ? (
    <div className="fixed bottom-24 left-4 right-4 bg-gray-800 border border-white/10 text-white text-sm px-4 py-3 rounded-2xl z-50 text-center shadow-xl">
      {toast}
    </div>
  ) : null;

  if (view === 'qr') {
    return (
      <div className="flex flex-col h-full bg-[#111111]">
        <SubHeader title="QR Code Settings" icon={QrCode} />
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-8">
          {currentQr && (
            <div className="mb-5 text-center">
              <p className="text-gray-500 text-xs font-medium mb-3 uppercase tracking-wide">Current QR Code</p>
              <div className="inline-block p-3 border-2 border-yellow-400/40 rounded-2xl">
                <img src={currentQr} alt="QR Code" className="w-48 h-48 object-contain rounded-xl" />
              </div>
              <p className="text-gray-600 text-xs mt-3">This QR is shown to users during online payment</p>
            </div>
          )}
          {!currentQr && (
            <div className="mb-5 bg-yellow-400/8 border border-yellow-400/20 rounded-2xl p-4 text-center">
              <QrCode size={32} className="text-yellow-400/50 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-gray-500 text-sm">No QR code set yet</p>
            </div>
          )}
          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-bold mb-1.5">Upload QR Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setQrFile(e.target.files?.[0] || null)}
              className="w-full bg-white/[0.06] border border-white/[0.1] text-gray-300 px-4 py-3 rounded-xl text-sm outline-none focus:border-yellow-400 transition-colors file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-yellow-400 file:text-gray-900"
            />
          </div>
          <button onClick={handleSaveQr} disabled={submitting || !qrFile}
            className="w-full bg-yellow-400 text-gray-900 font-black py-4 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-60 shadow-lg shadow-yellow-900/30">
            {submitting ? 'Uploading...' : 'Upload QR Code'}
          </button>
        </div>
        <Toast />
      </div>
    );
  }

  if (view === 'notifications') {
    return (
      <div className="flex flex-col h-full bg-[#111111]">
        <SubHeader title="Notifications" icon={Bell} />
        <div className="flex-1 overflow-y-auto pb-6 px-5 pt-5 space-y-4">
          <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4">
            <p className="text-white font-bold text-sm mb-3">Send New Notification</p>
            {darkInput('Title', notifTitle, setNotifTitle, 'Notification title')}
            <div className="mb-4">
              <label className="block text-gray-300 text-sm font-bold mb-1.5">Message</label>
              <textarea placeholder="Enter your message..." value={notifMsg} onChange={e => setNotifMsg(e.target.value)}
                rows={4}
                className="w-full bg-white/[0.06] border border-white/[0.1] text-white px-4 py-3 rounded-xl text-sm outline-none focus:border-yellow-400 placeholder-gray-600 resize-none transition-colors" />
            </div>
            <button onClick={handleSendNotif} disabled={submitting}
              className={`w-full font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${notifSent ? 'bg-emerald-500 text-white' : 'bg-yellow-400 text-gray-900'} disabled:opacity-60 shadow-lg shadow-yellow-900/20`}>
              {notifSent
                ? <><CheckCircle size={17} strokeWidth={2.5} /> Sent!</>
                : submitting
                  ? 'Sending...'
                  : <><Send size={15} strokeWidth={2.5} /> Send to All Users</>
              }
            </button>
          </div>

          {sentNotifs.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wide mb-3 px-1">
                Sent Notifications ({sentNotifs.length})
              </p>
              <div className="space-y-2">
                {sentNotifs.map(n => (
                  <div key={n.id} className="bg-white/[0.04] rounded-2xl p-4 border border-white/[0.06]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm">{n.title}</p>
                        <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{n.message}</p>
                        <p className="text-gray-600 text-xs mt-1.5">{fmtShort(n.created_at)}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteNotif(n.id)}
                        className="w-8 h-8 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center shrink-0 border border-red-500/20 active:scale-95 transition-transform"
                      >
                        <Trash2 size={13} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <Toast />
      </div>
    );
  }

  if (view === 'logs') {
    return (
      <div className="flex flex-col h-full bg-[#111111]">
        <SubHeader title="Activity Logs" icon={Activity} />
        <div className="flex-1 overflow-y-auto pb-6 px-4 pt-4 space-y-2">
          {loadError ? (
            <div className="flex flex-col items-center justify-center h-52 text-center gap-3">
              <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-400" strokeWidth={1.8} />
              </div>
              <p className="text-red-400 text-sm font-bold">Firestore Access Error</p>
              <p className="text-gray-500 text-xs leading-relaxed px-4">{loadError}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">No activity logs yet.</div>
          ) : logs.map(log => (
            <div key={log.id} className="bg-white/[0.04] rounded-xl p-3.5 border border-white/[0.06]">
              <div className="flex justify-between items-start mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                    log.actor_type === 'superadmin' ? 'bg-yellow-400/15 text-yellow-400' :
                    log.actor_type === 'admin' ? 'bg-blue-400/15 text-blue-400' :
                    'bg-gray-400/15 text-gray-400'
                  }`}>
                    {log.actor_type}
                  </span>
                  <span className="text-white text-sm font-bold">{log.actor_display_id}</span>
                </div>
                <span className="text-gray-600 text-xs shrink-0 ml-2">{fmtShort(log.created_at)}</span>
              </div>
              <p className="text-gray-300 text-xs capitalize">{log.action.replace(/_/g, ' ')}</p>
              {log.target_display_id && (
                <p className="text-gray-600 text-xs mt-0.5">→ {log.target_type}: {log.target_display_id}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'histories') {
    return (
      <div className="flex flex-col h-full bg-[#111111]">
        <SubHeader title="All Histories" icon={Trash2} />
        <div className="px-4 py-3 shrink-0">
          <p className="text-gray-500 text-xs">{histories.length} total transaction{histories.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex-1 overflow-y-auto pb-6 px-4 space-y-2">
          {loadError ? (
            <div className="flex flex-col items-center justify-center h-52 text-center gap-3">
              <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-400" strokeWidth={1.8} />
              </div>
              <p className="text-red-400 text-sm font-bold">Firestore Access Error</p>
              <p className="text-gray-500 text-xs leading-relaxed px-4">{loadError}</p>
            </div>
          ) : histories.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">No histories.</div>
          ) : histories.map(h => (
            <div key={h.id} className="bg-white/[0.04] rounded-xl p-3.5 border border-white/[0.06] flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white font-black">{fmt(h.amount)}</p>
                <p className="text-emerald-400 text-xs font-medium">Earning: {fmt(h.earning)}</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {h.user_name} ({h.user_display_id}) · {fmtShort(h.created_at)}
                </p>
              </div>
              <button
                onClick={() => handleDeleteHistory(h.id)}
                className="w-9 h-9 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center shrink-0 border border-red-500/25 active:scale-95 transition-transform"
              >
                <Trash2 size={14} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
        <Toast />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#111111]">
      <div className="px-5 pt-8 pb-5 shrink-0">
        <h1 className="text-2xl font-black text-white">Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Platform management tools</p>
      </div>

      <div className="flex-1 overflow-y-auto pb-6 px-4">
        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.07] overflow-hidden divide-y divide-white/[0.05]">
          {([
            { icon: QrCode, label: 'QR Code Settings', sub: 'Upload payment QR for users', action: () => setView('qr') },
            { icon: Bell, label: 'Notifications', sub: 'Send & manage notifications', action: () => setView('notifications') },
            { icon: Activity, label: 'Activity Logs', sub: 'View all admin & SA actions', action: () => setView('logs') },
            { icon: Trash2, label: 'Manage Histories', sub: 'View and delete transaction records', action: () => setView('histories') },
          ] as { icon: React.ElementType; label: string; sub: string; action: () => void }[]).map(({ icon: Icon, label, sub, action }) => (
            <button
              key={label}
              onClick={action}
              className="w-full flex items-center gap-4 px-5 py-4 text-left active:bg-white/[0.03] transition-colors"
            >
              <div className="w-10 h-10 bg-yellow-400/10 rounded-xl flex items-center justify-center shrink-0">
                <Icon size={18} className="text-yellow-400" strokeWidth={1.8} />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">{label}</p>
                <p className="text-gray-600 text-xs mt-0.5">{sub}</p>
              </div>
              <ChevronRight size={15} className="text-gray-600 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
