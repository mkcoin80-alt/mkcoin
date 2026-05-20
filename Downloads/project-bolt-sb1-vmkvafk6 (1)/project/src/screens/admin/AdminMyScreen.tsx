import { LogOut, Shield, Clock, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
// No external DB calls needed — profile data from session

export default function AdminMyScreen() {
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-full bg-[#111111]">
      {/* Profile header */}
      <div className="px-5 pt-8 pb-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-yellow-900/40">
            <span className="text-2xl font-black text-gray-900">
              {(user?.name || 'A').charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-white font-black text-lg leading-tight">{user?.name}</p>
            <p className="text-gray-400 text-sm mt-0.5">{user?.displayId}</p>
            <span className="mt-1.5 inline-block text-xs bg-yellow-400/15 text-yellow-400 px-2.5 py-0.5 rounded-full font-bold border border-yellow-400/20">
              Admin
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 px-4 space-y-3">
        {/* Info rows */}
        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.07] overflow-hidden divide-y divide-white/[0.05]">
          {([
            { icon: User, label: 'Admin ID', value: user?.displayId },
            { icon: Shield, label: 'Role', value: 'Admin' },
            { icon: Clock, label: 'Session', value: 'Active' },
          ] as { icon: React.ElementType; label: string; value?: string }[]).map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-4 px-5 py-4">
              <div className="w-8 h-8 bg-yellow-400/10 rounded-lg flex items-center justify-center shrink-0">
                <Icon size={15} className="text-yellow-400" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-gray-600 text-xs font-medium">{label}</p>
                <p className="text-white font-bold text-sm mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Permissions */}
        <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4">
          <p className="text-yellow-400 font-bold text-sm mb-3">Your Permissions</p>
          <div className="space-y-2.5">
            {[
              'Create users only (not admins)',
              'Search accounts by last 4 digits',
              'Add success histories (auto 25%)',
              'Approve / reject cash requests',
              'Temporarily ban / unban users',
            ].map(item => (
              <div key={item} className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full shrink-0" />
                <p className="text-gray-400 text-xs">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full bg-red-500/10 border border-red-500/25 text-red-400 font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <LogOut size={17} strokeWidth={2} />
          Logout
        </button>
      </div>
    </div>
  );
}
