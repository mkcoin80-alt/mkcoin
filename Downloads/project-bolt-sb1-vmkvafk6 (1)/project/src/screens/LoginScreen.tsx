import { useState } from 'react';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { login } from '../lib/auth';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { setUser } = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!userId.trim() || !password.trim()) {
      setError('Please enter your User ID and Password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const authUser = await login(userId.trim(), password.trim());
      setUser(authUser);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-yellow-400 pt-16 pb-12 px-6 flex flex-col items-center">
        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl mb-4">
          <span className="text-3xl font-black text-yellow-400">MK</span>
        </div>
        <h1 className="text-3xl font-black text-white">MK Coin</h1>
        <p className="text-yellow-100 text-sm mt-1 font-medium">Finance Platform</p>
      </div>

      {/* Card */}
      <div className="flex-1 px-5 -mt-8 relative z-10 pb-10">
        <div className="bg-white rounded-3xl shadow-2xl p-6">
          <h2 className="text-xl font-black text-gray-900 mb-1">Welcome Back</h2>
          <p className="text-gray-400 text-sm mb-6">Sign in to your account</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-2">User ID</label>
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 gap-3 focus-within:border-yellow-400 transition-colors">
              <User size={17} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="e.g. aman1322"
                value={userId}
                onChange={e => setUserId(e.target.value)}
                className="flex-1 bg-transparent text-gray-900 text-sm outline-none placeholder-gray-400"
                autoComplete="off"
                autoCapitalize="off"
              />
            </div>
          </div>

          <div className="mb-7">
            <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 gap-3 focus-within:border-yellow-400 transition-colors">
              <Lock size={17} className="text-gray-400 shrink-0" />
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="flex-1 bg-transparent text-gray-900 text-sm outline-none placeholder-gray-400"
              />
              <button onClick={() => setShowPw(v => !v)} className="text-gray-400 p-0.5">
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-yellow-400 text-gray-900 font-black py-4 rounded-2xl text-base active:scale-[0.98] transition-transform disabled:opacity-60 shadow-md shadow-yellow-200"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="text-center text-xs text-gray-400 mt-5">
            Contact your administrator to get access
          </p>
        </div>
      </div>
    </div>
  );
}
