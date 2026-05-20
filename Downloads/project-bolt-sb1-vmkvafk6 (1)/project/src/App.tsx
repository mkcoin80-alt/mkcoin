import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import UserDashboard from './screens/user/UserDashboard';
import AdminDashboard from './screens/admin/AdminDashboard';
import SuperAdminDashboard from './screens/superadmin/SuperAdminDashboard';

function AppContent() {
  const [splash, setSplash] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    document.title = 'MK Coin';
  }, []);

  if (splash) return <SplashScreen onDone={() => setSplash(false)} />;
  if (!user) return <LoginScreen />;
  if (user.role === 'superadmin') return <SuperAdminDashboard />;
  if (user.role === 'admin') return <AdminDashboard />;
  return <UserDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-300 flex items-center justify-center">
        <div className="w-full max-w-sm min-h-screen bg-white shadow-2xl overflow-hidden relative">
          <AppContent />
        </div>
      </div>
    </AuthProvider>
  );
}
