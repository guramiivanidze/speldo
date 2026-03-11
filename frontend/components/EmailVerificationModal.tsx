'use client';

import { useState } from 'react';
import { sendUserVerificationCode, verifyUserEmail, sendEmailChangeCode, changeEmail } from '@/lib/api';

interface EmailVerificationModalProps {
  isOpen: boolean;
  email: string;
  onVerified: (newEmail?: string) => void;
  onClose: () => void;
}

export default function EmailVerificationModal({ 
  isOpen, 
  email, 
  onVerified, 
  onClose 
}: EmailVerificationModalProps) {
  const [step, setStep] = useState<'initial' | 'code' | 'changeEmail' | 'changeEmailCode'>('initial');
  const [verificationToken, setVerificationToken] = useState('');
  const [code, setCode] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSendCode = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await sendUserVerificationCode();
      setVerificationToken(result.verification_token);
      setStep('code');
      setSuccess('Verification code sent to your email!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await verifyUserEmail(code, verificationToken);
      setSuccess('Email verified successfully!');
      setTimeout(() => {
        onVerified();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendChangeEmailCode = async () => {
    if (!newEmail.trim()) {
      setError('Please enter a new email address');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const result = await sendEmailChangeCode(newEmail.trim());
      setVerificationToken(result.verification_token);
      setStep('changeEmailCode');
      setSuccess(`Verification code sent to ${newEmail}!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    if (code.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await changeEmail(newEmail.trim(), verificationToken, code);
      setSuccess('Email changed and verified successfully!');
      setTimeout(() => {
        onVerified(newEmail.trim());
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change email');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (value: string) => {
    // Only allow digits, max 6 chars
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setCode(cleaned);
    if (error) setError('');
  };

  return (
    <div 
      className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="max-w-md w-full animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✉️</span>
              <div>
                <h2 className="text-lg font-bold text-slate-100">Verify Your Email</h2>
                <p className="text-slate-400 text-sm">One-time verification required</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-2xl leading-none hover:bg-slate-700/50 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            >
              ×
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 space-y-4">
            {step === 'initial' && (
              <>
                <p className="text-slate-300">
                  To continue using all features, please verify your email address:
                </p>
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                  <p className="text-slate-400 text-sm">Your email</p>
                  <p className="text-lg font-medium text-slate-100">{email}</p>
                </div>
                <p className="text-slate-400 text-sm">
                  We'll send a 6-digit verification code to this email address.
                </p>
                <button
                  type="button"
                  onClick={() => { setStep('changeEmail'); setError(''); setSuccess(''); }}
                  className="text-sm text-indigo-400 hover:text-indigo-300"
                >
                  Wrong email? Change it →
                </button>
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
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => { setStep('initial'); setCode(''); setError(''); }}
                    className="text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    ← Send a new code
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStep('changeEmail'); setCode(''); setError(''); setSuccess(''); }}
                    className="text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    Change email →
                  </button>
                </div>
              </>
            )}
            
            {step === 'changeEmail' && (
              <>
                <p className="text-slate-300">
                  Enter your new email address:
                </p>
                <div className="bg-slate-800/50 rounded-xl p-3 mb-2">
                  <p className="text-slate-500 text-xs">Current email</p>
                  <p className="text-slate-400 text-sm">{email}</p>
                </div>
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
                  placeholder="newemail@example.com"
                  value={newEmail}
                  onChange={(e) => { setNewEmail(e.target.value); if (error) setError(''); }}
                  autoFocus
                />
                <p className="text-slate-400 text-sm">
                  We'll send a verification code to this new email.
                </p>
                <button
                  type="button"
                  onClick={() => { setStep('initial'); setNewEmail(''); setError(''); setSuccess(''); }}
                  className="text-sm text-indigo-400 hover:text-indigo-300"
                >
                  ← Back to current email
                </button>
              </>
            )}
            
            {step === 'changeEmailCode' && (
              <>
                <p className="text-slate-300">
                  Enter the 6-digit code sent to <span className="font-medium text-slate-100">{newEmail}</span>
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
                  onClick={() => { setStep('changeEmail'); setCode(''); setError(''); }}
                  className="text-sm text-indigo-400 hover:text-indigo-300"
                >
                  ← Change email or resend code
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
            {step === 'initial' && (
              <button
                onClick={handleSendCode}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>
            )}
            
            {step === 'code' && (
              <button
                onClick={handleVerify}
                disabled={loading || code.length !== 6}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Verify Email'}
              </button>
            )}
            
            {step === 'changeEmail' && (
              <button
                onClick={handleSendChangeEmailCode}
                disabled={loading || !newEmail.trim()}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Code to New Email'}
              </button>
            )}
            
            {step === 'changeEmailCode' && (
              <button
                onClick={handleChangeEmail}
                disabled={loading || code.length !== 6}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Changing...' : 'Change & Verify Email'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
