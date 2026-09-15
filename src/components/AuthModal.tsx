import React, { useState } from 'react';
import { X, Mail, Lock, Loader2, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userEmail: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured || !supabase) {
      // Demo / fallback local account if Supabase credentials are not added yet
      if (email.trim() && password.length >= 6) {
        onSuccess(email.trim().toLowerCase());
        onClose();
        return;
      }
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          onSuccess(data.user?.email || email);
          onClose();
        } else {
          setMessage('Account created! Please check your email or sign in.');
          setIsSignUp(false);
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        if (data.user) {
          onSuccess(data.user.email || email);
          onClose();
        }
      }
    } catch (err: any) {
      setError(err.message || 'An authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#000000] border border-[#222222] rounded-2xl p-6 shadow-2xl text-[#FFFFFF]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#222222]">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#FFFFFF]" />
            <h2 className="text-sm font-bold tracking-tight text-[#FFFFFF]">
              {isSignUp ? 'Create KindleFlow Account' : 'Sign In to KindleFlow'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#888888] hover:text-[#FFFFFF] hover:bg-[#111111] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isSupabaseConfigured && (
          <div className="p-3.5 rounded-xl bg-[#000000] border border-[#222222] text-xs text-[#888888] space-y-2 mb-4">
            <div className="flex items-center gap-2 text-[#FFFFFF] text-xs font-semibold">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#FFFFFF]" />
              <span>Personal Account Login</span>
            </div>
            <p className="text-[11px] text-[#888888]">
              You can sign in directly to isolate your private books on this device, or add your Supabase credentials in <code className="text-white">.env</code> for cloud backup.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-[#000000] border border-[#444444] text-xs text-[#FFFFFF] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#FFFFFF]" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="p-3 rounded-xl bg-[#000000] border border-[#444444] text-xs text-[#FFFFFF] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#FFFFFF]" />
              <span>{message}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-mono text-[#888888] mb-1.5 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#000000] border border-[#222222] rounded-xl text-[#FFFFFF] placeholder-[#666666] focus:outline-none focus:border-[#444444] transition font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-[#888888] mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#000000] border border-[#222222] rounded-xl text-[#FFFFFF] placeholder-[#666666] focus:outline-none focus:border-[#444444] transition font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-[#FFFFFF] hover:bg-[#E5E5E5] text-[#000000] text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-[#222222] text-center text-xs">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setMessage(null);
            }}
            className="text-[#888888] hover:text-[#FFFFFF] transition text-xs font-normal"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
};
