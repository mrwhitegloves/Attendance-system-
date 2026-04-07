"use client";

import Image from 'next/image';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { Shield, LayoutDashboard, Database, Activity, LogOut, FileText, Users } from 'lucide-react';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUser = () => {
      const savedUser = localStorage.getItem('user');
      setUser(savedUser ? JSON.parse(savedUser) : null);
    };
    checkUser();
    window.addEventListener('storage', checkUser);
    return () => window.removeEventListener('storage', checkUser);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  return (
    <nav className="h-20 flex items-center justify-between px-6 lg:px-12 bg-black/80 backdrop-blur-2xl border-b border-brand-border sticky top-0 z-[100] animate-fade-in font-sans">
      <Link href="/" className="flex items-center gap-4 group">
        <div className="w-11 h-11 bg-white/[0.03] border border-white/10 flex items-center justify-center rounded-xl transition-all duration-500 group-hover:bg-brand-red group-hover:shadow-[0_0_20px_rgba(230,30,42,0.6)] group-hover:rotate-6">
          <Image src="/logo.png" alt="MWG" width={32} height={32} className="rounded" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-lg font-black tracking-tighter text-white">White Gloves</span>
          <span className="text-[9px] font-black tracking-[3px] uppercase text-brand-red">Technologies</span>
        </div>
      </Link>

      <div className="hidden lg:flex items-center gap-10">
        {[
          { label: 'Workforce', icon: Users },
          { label: 'Reports', icon: FileText },
          { label: 'Activity', icon: Activity }
        ].map(item => (
          <Link 
            key={item.label}
            href="#" 
            className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-all group"
          >
            <item.icon size={14} className="group-hover:text-brand-red transition-colors" />
            {item.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-4">
        {!user ? (
          <>
            <Link href="/login" className="hidden sm:block text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white px-6 py-3 transition-colors">
              Login
            </Link>
            <Link href="/signup" className="flex items-center gap-2 bg-brand-red text-white text-xs font-bold uppercase tracking-widest px-8 py-3.5 rounded-xl hover:bg-red-700 transition-all active:scale-95 shadow-xl shadow-red-900/20">
              <Shield size={14} /> Create Account
            </Link>
          </>
        ) : (
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-3 bg-white/5 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest px-6 py-3 rounded-lg hover:bg-brand-red hover:border-brand-red transition-all"
          >
            <LogOut size={14} /> Logout
          </button>
        )}
      </div>
    </nav>
  );
}
