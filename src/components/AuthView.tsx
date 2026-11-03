import React, { useState } from 'react';
import { ArrowRight, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { callSheetsBackend } from '../services/gasClient';
import {
  validateLoginInput,
  validateSignupInput,
  type GasResponse,
} from '../utils/sheetsProtocol';

interface AuthViewProps {
  onAuthenticated: (res: GasResponse) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
      const check = validateSignupInput({ fullName, email, password });
      if (!check.valid) {
        setError(check.error || 'Please verify your account details.');
        return;
      }
    } else {
      const check = validateLoginInput({ email, password });
      if (!check.valid) {
        setError(check.error || 'Please enter your email and password.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await callSheetsBackend(
        mode === 'signup'
          ? {
              action: 'signup',
              fullName,
              email,
              password,
              roleTitle: roleTitle.trim() || 'Team Member',
            }
          : {
              action: 'login',
              email,
              password,
            }
      );

      if (!res.ok || !res.user) {
        setError(res.error || 'Authentication failed. Please check your credentials.');
        return;
      }

      onAuthenticated(res);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach workspace authentication service.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 text-slate-900">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Relay
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace account'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
          {/* Mode Switcher */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`rounded-md py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
              }}
              className={`rounded-md py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                mode === 'signup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === 'signup' && (
              <>
                <div>
                  <label
                    htmlFor="auth-full-name"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Full Name
                  </label>
                  <div className="relative mt-1.5">
                    <User className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                    <input
                      id="auth-full-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Elena Rostova"
                      className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3.5 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="auth-role-title"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Role / Title <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <div className="relative mt-1.5">
                    <ShieldCheck className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                    <input
                      id="auth-role-title"
                      type="text"
                      value={roleTitle}
                      onChange={(e) => setRoleTitle(e.target.value)}
                      placeholder="Engineer"
                      className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3.5 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-semibold text-slate-700"
              >
                Email
              </label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3.5 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-semibold text-slate-700"
              >
                Password
              </label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3.5 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <span>
                {submitting
                  ? mode === 'signup'
                    ? 'Creating Account...'
                    : 'Signing In...'
                  : mode === 'signup'
                  ? 'Create Account'
                  : 'Sign In'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </main>
  );
};
