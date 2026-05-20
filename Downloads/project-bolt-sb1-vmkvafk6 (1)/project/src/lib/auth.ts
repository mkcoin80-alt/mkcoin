import {
  collection, query, where, getDocs, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, AuthUser } from './firebase';

export async function login(userId: string, password: string): Promise<AuthUser> {
  // Check super_admins
  const saSnap = await getDocs(
    query(collection(db, 'super_admins'), where('super_admin_id', '==', userId), where('password', '==', password))
  );
  if (!saSnap.empty) {
    const sa = saSnap.docs[0];
    const saData = sa.data();
    if (saData.is_active === false) throw new Error('Your account is inactive.');
    return { id: sa.id, displayId: saData.super_admin_id, name: saData.name, role: 'superadmin' };
  }

  // Check admins
  const adminSnap = await getDocs(
    query(collection(db, 'admins'), where('admin_id', '==', userId), where('password', '==', password))
  );
  if (!adminSnap.empty) {
    const admin = adminSnap.docs[0];
    const adminData = admin.data();
    if (adminData.is_banned) throw new Error('Your account has been banned. Contact Super Admin.');
    return { id: admin.id, displayId: adminData.admin_id, name: adminData.name, role: 'admin' };
  }

  // Check users
  const userSnap = await getDocs(
    query(collection(db, 'users'), where('user_id', '==', userId), where('password', '==', password))
  );
  if (!userSnap.empty) {
    const u = userSnap.docs[0];
    const uData = u.data();
    if (uData.is_banned) throw new Error('Your account has been banned. Contact Admin.');
    return { id: u.id, displayId: uData.user_id, name: uData.name, role: 'user' };
  }

  throw new Error('Invalid User ID or Password.');
}

export function saveSession(u: AuthUser) {
  localStorage.setItem('mk_session', JSON.stringify(u));
}

export function loadSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem('mk_session');
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem('mk_session');
}

export async function logActivity(
  actorType: string,
  actorId: string,
  actorDisplayId: string,
  action: string,
  targetType = '',
  targetId: string | null = null,
  targetDisplayId = '',
  details: Record<string, unknown> = {}
) {
  await addDoc(collection(db, 'activity_logs'), {
    actor_type: actorType,
    actor_id: actorId,
    actor_display_id: actorDisplayId,
    action,
    target_type: targetType,
    target_id: targetId,
    target_display_id: targetDisplayId,
    details,
    created_at: serverTimestamp(),
  });
}
