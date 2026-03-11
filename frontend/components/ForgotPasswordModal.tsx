'use client';

import { useState } from 'react';
import { sendPasswordResetCode, resetPassword } from '@/lib/api';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ForgotPasswordModal({ 
  isOpen, 
  onClose,
  onSuccess,
}: ForgotPasswordModalProps) {
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('email');
    setEmail('');
    setVerificationToken('');
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
    setShowPassword(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSendCode = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const result = await sendPasswordResetCode(email.trim().toLowerCase());
      setVerificationToken(result.verification_token);
      setStep('code');
      setSuccess('If an account exists, a reset code has been sent!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = () => {
    if (code.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    setError('');
    setSuccess('');
    setStep('password');
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await resetPassword(email, code, verificationToken, newPassword);
      setSuccess('Password reset successfully!');
      setTimeout(() => {
        handleReset();
        onSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setCode(cleaned);
    if (error) setError('');
  };

  return (
    <div 
      className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div 
        className="max-w-md w-full animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔐</span>
              <div>
                <h2 className="text-lg font-bold text-slate-100">Reset Password</h2>
                <p className="text-slate-400 text-sm">
                  {step === 'email' && 'Enter your email address'}
                  {step === 'code' && 'Enter verification code'}
                  {step === 'password' && 'Set your new password'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-200 text-2xl leading-none hover:bg-slate-700/50 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            >
              ×
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 space-y-4">
            {step === 'email' && (
              <>
                <p className="text-slate-300">
                  Enter the email address associated with your account and we'll send you a code to reset your password.
                </p>
                <input
                  type="email"
                  className={`
                    w-full px-4 py-3 rounded-xl
                    bg-slate-800 border text-slate-100 placeholder-slate-500
                    focus:outline-none focus:ring-1 transition-colors
                    ${error 
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50' 
                      : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/50'}
                  `}
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                  autoFocus
                />
              </>
            )}

            {step === 'code' && (
              <>
                <p className="text-slate-300">
                  Enter the 6-digit code sent to <span className="font-medium text-slate-100">{email}</span>
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  className={`
                    w-full px-4 py-3 rounded-xl text-center
                    bg-slate-800 border text-slate-100 placeholder-slate-500
                    focus:outline-none focus:ring-1 transition-colors
                    font-mono text-2xl tracking-[0.3em]
                    ${error 
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50' 
                      : code.length === 6
                        ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/50'
                        : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/50'}
                  `}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { setStep('email'); setCode(''); setError(''); setSuccess(''); }}
                  className="text-sm text-indigo-400 hover:text-indigo-300"
                >
                  ← Change email or resend code
                </button>
              </>
            )}

            {step === 'password' && (
              <>
                <p className="text-slate-300">
                  Create a new password for your account.
                </p>
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className={`
                        w-full px-4 py-3 pr-12 rounded-xl
                        bg-slate-800 border text-slate-100 placeholder-slate-500
                        focus:outline-none focus:ring-1 transition-colors
                        ${error 
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50' 
                          : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/50'}
                      `}
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); if (error) setError(''); }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`
                      w-full px-4 py-3 rounded-xl
                      bg-slate-800 border text-slate-100 placeholder-slate-500
                      focus:outline-none focus:ring-1 transition-colors
                      ${error 
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50' 
                        : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/50'}
                    `}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(''); }}
                  />
                </div>
                <p className="text-slate-500 text-xs">
                  Password must be at least 8 characters with uppercase, lowercase, number, and special character.
                </p>
                <button
                  type="button"
                  onClick={() => { setStep('code'); setNewPassword(''); setConfirmPassword(''); setError(''); }}
                  className="text-sm text-indigo-400 hover:text-indigo-300"
                >
                  ← Back to code
                </button>
              </>
            )}

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}
            {success && !error && (
              <p className="text-emerald-400 text-sm text-center">{success}</p>
            )}
          </div>
          
          {/* Actions */}
          <div className="px-6 pb-6">
            {step === 'email' && (
              <button
                onClick={handleSendCode}
                disabled={loading || !email.trim()}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
            )}
            {step === 'code' && (
              <button
                onClick={handleVerifyCode}
                disabled={code.length !== 6}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            )}
            {step === 'password' && (
              <button
                onClick={handleResetPassword}
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
