import React, { useState } from 'react';

import { ArrowRight, Check, Hash, MessageSquare, Users } from 'lucide-react';

import { Button } from './ui/Button';

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



  const inputClass = 'mt-2 h-11 w-full rounded-md border border-[#d8dcde] bg-white px-3 text-sm text-[#20252a] placeholder:text-[#72777d] transition-colors focus:border-[#217a5b] focus:outline-none focus:ring-2 focus:ring-[#217a5b]/10';



  return (

    <main className="grid min-h-dvh bg-white text-[#20252a] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">

      <section className="relative hidden flex-col overflow-hidden bg-[#202b28] px-12 py-10 text-white lg:flex xl:px-20">

        <div className="flex items-center gap-3 text-2xl font-semibold tracking-tight">

          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#d5eddd] text-xl font-bold text-[#244b3b]">r</span>

          relay<span className="ml-1 text-xs font-normal tracking-normal text-white/60"> / your team, connected</span>

        </div>

        <div className="my-auto py-16">

          <div className="mb-6 inline-flex items-center gap-2 text-xs font-medium tracking-widest text-[#b7d1c2] uppercase"><span className="h-1.5 w-1.5 rounded-full bg-[#a6cfb6]" /> A little less noise. A lot more together.</div>

          <h2 className="max-w-md text-5xl leading-[1.12] font-semibold tracking-[-0.04em] xl:text-6xl">Good work starts<br />with a conversation.</h2>

          <p className="mt-6 max-w-sm text-base leading-7 text-[#b7c4bf]">Bring your people, projects, and everyday conversations into one thoughtful workspace.</p>

          <div aria-hidden="true" className="mt-12 max-w-sm overflow-hidden rounded-lg border border-white/15 bg-[#2a3631]">

            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-sm font-semibold"><Hash className="h-4 w-4 text-[#b7d1c2]" /> team-work <span className="ml-auto rounded bg-white/10 px-2 py-0.5 text-[10px] font-normal text-white/70">A place for every project</span></div>

            <div className="space-y-5 p-5">

              <div className="flex gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#d9be97] text-xs font-bold text-[#4b3a26]">JD</div><div className="w-full space-y-2"><div className="h-2 w-20 rounded-sm bg-white/65" /><div className="h-2 w-full rounded-sm bg-white/20" /><div className="h-2 w-3/4 rounded-sm bg-white/20" /></div></div>

              <div className="flex gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#b7c9dc] text-xs font-bold text-[#34475c]">AK</div><div className="w-full space-y-2"><div className="h-2 w-24 rounded-sm bg-white/65" /><div className="h-2 w-5/6 rounded-sm bg-white/20" /><span className="inline-flex items-center gap-1 rounded border border-[#8fbea3]/30 bg-[#8fbea3]/10 px-2 py-1 text-[11px] text-[#c5e3d1]"><Check className="h-3 w-3" /> On the same page</span></div></div>

            </div>

            <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3 text-xs text-[#a9beb3]"><MessageSquare className="h-3.5 w-3.5" /> Conversations that move work forward</div>

          </div>

        </div>

        <div className="flex items-center gap-2 text-xs text-[#9fb2a7]"><Users className="h-4 w-4" /> Built for the way teams work together.</div>

      </section>



      <section className="flex min-w-0 flex-col px-6 py-8 sm:px-12">

        <div className="flex items-center gap-2 text-xl font-semibold tracking-tight lg:hidden"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#217a5b] text-white">r</span>relay</div>

        <div className="flex justify-end text-xs text-[#72777d]">

          {mode === 'login' ? 'New to Relay?' : 'Already have an account?'}

          <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} className="ml-2 font-semibold text-[#217a5b] underline-offset-4 hover:underline">{mode === 'login' ? 'Create an account' : 'Sign in'}</button>

        </div>

        <div className="mx-auto my-auto w-full max-w-[380px] py-12">

          <p className="mb-3 text-xs font-semibold tracking-widest text-[#217a5b] uppercase">Your workspace awaits</p>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{mode === 'login' ? 'Welcome back.' : 'Make room for better work.'}</h1>

          <p className="mt-3 text-sm leading-6 text-[#72777d]">{mode === 'login' ? 'Sign in to pick up where your team left off.' : 'Create your account and join the conversation.'}</p>

          <form onSubmit={handleSubmit} className="mt-9 space-y-5" noValidate>

            {mode === 'signup' && <>

              <div><label htmlFor="auth-full-name" className="text-sm font-medium">Full name</label><input id="auth-full-name" type="text" autoComplete="name" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" className={inputClass} /></div>

              <div><label htmlFor="auth-role-title" className="text-sm font-medium">Job title <span className="font-normal text-[#72777d]">(optional)</span></label><input id="auth-role-title" type="text" autoComplete="organization-title" value={roleTitle} onChange={e => setRoleTitle(e.target.value)} placeholder="e.g. Product designer" className={inputClass} /></div>

            </>}

            <div><label htmlFor="auth-email" className="text-sm font-medium">Work email</label><input id="auth-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className={inputClass} /></div>

            <div><label htmlFor="auth-password" className="text-sm font-medium">Password</label><input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'} className={inputClass} /></div>

            {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">{error}</div>}

            <Button type="submit" variant="primary" loading={submitting} className="h-11 w-full">

              {submitting ? (mode === 'signup' ? 'Creating account…' : 'Signing in…') : (mode === 'signup' ? 'Create account' : 'Sign in to Relay')}<ArrowRight className="ml-auto h-4 w-4" />

            </Button>

          </form>

          <p className="mt-6 text-center text-xs leading-5 text-[#72777d]">One place to connect. More space to do your best work.</p>

        </div>

        <p className="text-center text-[11px] text-[#72777d]">Relay · Thoughtfully connected.</p>

      </section>

    </main>

  );

};

