"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn, Mail, Lock, ArrowRight, UserCircle } from 'lucide-react';
import Loader from '@/components/Loader';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password }),
      });

      if (res.ok) {
        const userData = await res.json();
        localStorage.setItem('user', JSON.stringify(userData));
        router.push('/');
      } else {
        const error = await res.json();
        alert(error.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden selection:bg-brand-red selection:text-white font-sans">
      {/* Visual Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-brand-red/10 blur-[150px] rounded-full"></div>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#e61e2a 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      <div className="w-full max-w-[440px] bg-brand-card/80 backdrop-blur-2xl border border-brand-border rounded-[32px] p-8 lg:p-10 shadow-2xl relative z-10 animate-fade-in">
        <div className="text-center space-y-2 mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 bg-brand-red rounded-2xl flex items-center justify-center shadow-xl shadow-red-900/20">
               <UserCircle size={32} className="text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Login</h1>
          <p className="text-zinc-500 font-medium text-sm">Sign in to your workforce portal</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-400 block ml-1" htmlFor="email">MWG-ID or Email</label>
            <div className="relative group">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-brand-red transition-colors" />
              <input 
                type="text" 
                id="email" 
                placeholder="MWG-001 or name@email.com" 
                className="w-full bg-black/50 border border-brand-border rounded-xl py-3.5 pl-12 pr-6 outline-none focus:border-brand-red/50 transition-all text-white placeholder:text-zinc-700"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center ml-1">
              <label className="text-xs font-bold text-zinc-400" htmlFor="password">Password</label>
              <a href="#" className="text-xs font-bold text-brand-red hover:underline">Forgot?</a>
            </div>
            <div className="relative group">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-brand-red transition-colors" />
              <input 
                type="password" 
                id="password" 
                placeholder="Enter your password" 
                className="w-full bg-black/50 border border-brand-border rounded-xl py-3.5 pl-12 pr-6 outline-none focus:border-brand-red/50 transition-all text-white placeholder:text-zinc-700"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full group bg-brand-red py-4 rounded-xl flex items-center justify-center gap-3 font-bold text-lg transition-all hover:bg-red-700 active:scale-95 shadow-xl shadow-red-900/20 disabled:grayscale disabled:opacity-50"
          >
            {loading ? <span className="flex items-center justify-center gap-2"><Loader className="w-6 h-6" /> SECURING...</span> : 'Login'}
            {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-zinc-500 font-medium text-sm">
            Don't have an account? <Link href="/signup" className="text-brand-red hover:underline font-bold">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
