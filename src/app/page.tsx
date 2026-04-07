"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import AttendanceSystem from '@/components/AttendanceSystem';
import AdminDashboard from '@/components/AdminDashboard';
import Image from 'next/image';
import Link from 'next/link';
import { Shield, Users, Activity, LogOut, Menu, X, ArrowRight, Zap, Globe, Lock } from 'lucide-react';

interface Profile {
  name: string;
  employeeId: string;
  department: string;
  staffType: 'Office Staff' | 'Field Staff';
  isAdmin?: boolean;
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [liveCount, setLiveCount] = useState(1432);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) setProfile(JSON.parse(savedUser));
    setIsLoaded(true);

    const interval = setInterval(() => {
      setLiveCount(prev => prev + Math.floor(Math.random() * 3) - 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!isLoaded) return null;

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans overflow-x-hidden selection:bg-brand-red selection:text-white">
      {!profile && (
        <>
          {/* Mobile Navigation */}
          <nav className="lg:hidden fixed top-0 inset-x-0 h-20 bg-black/95 backdrop-blur-3xl border-b border-white/10 px-6 flex items-center justify-between z-[1000]">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-red rounded-xl flex items-center justify-center p-1.5 shadow-xl shadow-red-900/40">
                <Image src="/logo.png" alt="MWG" width={32} height={32} className="rounded" />
              </div>
              <div className="leading-none">
                <div className="text-sm font-bold tracking-tight">White Gloves</div>
                <div className="text-[9px] font-bold uppercase text-brand-red tracking-widest">Technologies</div>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/login" className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold">Login</Link>
              <button className="w-10 h-10 bg-brand-red rounded-lg flex items-center justify-center text-white active:scale-95 transition-all shadow-lg shadow-red-900/20" onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
            
            {menuOpen && (
              <div className="absolute top-full right-6 left-6 mt-4 p-6 bg-brand-card/95 backdrop-blur-3xl border border-white/10 rounded-3xl flex flex-col gap-4 shadow-[0_40px_100px_rgba(0,0,0,0.8)] animate-fade-in origin-top">
                <Link href="/login" onClick={() => setMenuOpen(false)} className="text-lg font-bold text-zinc-300 hover:text-white transition-colors flex justify-between items-center px-4 py-2">Account Login <ArrowRight size={18} /></Link>
                <Link href="/signup" onClick={() => setMenuOpen(false)} className="text-lg font-bold text-zinc-300 hover:text-white transition-colors flex justify-between items-center px-4 py-2">Create Account <ArrowRight size={18} /></Link>
                <div className="h-px bg-white/5 my-2"></div>
                <Link href="/login" onClick={() => setMenuOpen(false)} className="text-lg font-bold text-brand-red hover:text-white transition-colors flex justify-between items-center px-4 py-2 italic font-black">Admin Access <Lock size={18} /></Link>
              </div>
            )}
          </nav>

          {/* Desktop Navbar */}
          <div className="hidden lg:block"><Navbar /></div>

          {/* Hero Section Container */}
          <div className="relative pt-20 lg:pt-0">
            {/* Ambient Background Elements */}
            <div className="absolute inset-x-0 top-0 h-[800px] pointer-events-none z-0">
              <div className="absolute top-0 left-[-10%] w-[60%] h-[100%] bg-brand-red/10 blur-[180px] rounded-full"></div>
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#e61e2a 1px, transparent 1px)', backgroundSize: '50px 50px' }}></div>
            </div>

            {/* Landing Content */}
            <section className="relative z-10 container mx-auto px-6 lg:px-12 py-16 lg:py-40 flex flex-col lg:flex-row items-center gap-16 lg:gap-32">
               <div className="flex-1 space-y-8 lg:space-y-12 animate-fade-in max-w-2xl text-center lg:text-left">
                  <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-full text-green-500 text-[10px] lg:text-xs font-bold uppercase tracking-wider">
                     <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                     </span>
                     {liveCount.toLocaleString()} EMPLOYEES ONLINE
                  </div>

                  <h1 className="text-5xl lg:text-8xl font-black tracking-tight leading-none uppercase">
                     Digital<br />
                     <span className="text-brand-red">Attendance</span>
                     <br />System.
                  </h1>

                  <p className="text-zinc-500 text-lg lg:text-2xl font-medium tracking-tight leading-relaxed max-w-xl mx-auto lg:mx-0">
                     Smart attendance tracking for White Gloves Technologies workforce. Simple, fast, and secure.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                     <Link href="/signup" className="w-full sm:w-auto">
                        <button className="group w-full sm:w-max bg-brand-red text-white py-5 px-10 rounded-2xl font-bold text-xl flex items-center justify-center gap-4 hover:bg-red-700 transition-all active:scale-95 shadow-xl shadow-red-900/40">
                           Join Workforce
                           <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                     </Link>
                     <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest sm:max-w-[150px] text-center sm:text-left">
                        Authorized Access Only v4.0
                     </p>
                  </div>

                  <div className="grid grid-cols-3 gap-6 lg:gap-10 pt-10 border-t border-white/5 group">
                    {[
                      { l: 'Employees', v: '10K+', i: Users },
                      { l: 'Security', v: '99.9%', i: Shield },
                      { l: 'Support', v: '24/7', i: Globe }
                    ].map((s, i) => (
                      <div key={i} className="flex flex-col items-center lg:items-start transition-opacity">
                         <div className="flex items-center gap-2 text-zinc-300 font-bold text-lg lg:text-2xl tracking-tight mb-1">
                            <s.i size={16} className="text-brand-red" /> {s.v}
                         </div>
                         <span className="text-[9px] lg:text-[10px] font-bold uppercase text-zinc-700 tracking-widest">{s.l}</span>
                      </div>
                    ))}
                  </div>
               </div>

               <div className="flex-1 w-full lg:w-auto relative group animate-fade-in" style={{ animationDelay: '0.4s' }}>
                  <div className="relative bg-brand-card/30 backdrop-blur-md border border-white/10 p-2 lg:p-3 rounded-[40px] shadow-2xl overflow-hidden lg:-rotate-3 group-hover:rotate-0 transition-transform duration-700">
                     <div className="relative aspect-[4/5] lg:h-[650px] w-full rounded-[32px] overflow-hidden border border-white/5 bg-[#050505]">
                        <Image src="/hero.png" alt="Employee Panel" fill className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" priority />
                        
                        <div className="absolute inset-0 p-6 flex flex-col justify-between pointer-events-none">
                           <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-xl flex items-center gap-3 w-max">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-[10px] font-bold uppercase text-zinc-100 tracking-widest">Mark Presence</span>
                           </div>

                           <div className="bg-black/80 backdrop-blur-2xl border border-white/5 p-6 rounded-3xl space-y-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 bg-brand-red rounded-full flex items-center justify-center font-bold text-white shadow-lg shadow-red-900/40">G</div>
                                 <div className="flex-grow">
                                    <div className="h-2 w-20 bg-white/20 rounded-full mb-2"></div>
                                    <div className="h-1.5 w-12 bg-white/10 rounded-full"></div>
                                 </div>
                              </div>
                              <div className="h-10 bg-green-500/20 rounded-xl border border-green-500/30 flex items-center justify-center text-[9px] font-black text-green-500 tracking-widest uppercase">Verified Check-in</div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </section>
          </div>
        </>
      )}

      {profile && (profile.isAdmin ? (
        <AdminDashboard profile={profile} />
      ) : (
        <AttendanceSystem profile={profile} />
      ))}

      {/* Global Signup CTA for Mobile */}
      {!profile && (
        <div className="sticky bottom-8 inset-x-0 z-[500] px-6 lg:hidden">
           <Link href="/login">
              <button className="w-full py-4 bg-white text-black font-extrabold uppercase text-xs tracking-widest rounded-xl shadow-2xl shadow-black border border-white/20 active:scale-95 transition-all">
                Login to Portal
              </button>
           </Link>
        </div>
      )}

      {(!profile || !profile.isAdmin) && (
        <footer className="relative z-10 bg-black pt-16 pb-10 lg:py-24 border-t border-white/5">
           <div className="container mx-auto px-6 lg:px-12">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-12 lg:gap-32">
                 <div className="space-y-4">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center rounded-xl">
                          <Image src="/logo.png" alt="MWG" width={28} height={28} />
                       </div>
                       <div className="font-bold text-xl uppercase tracking-tight leading-none">
                          White Gloves<br /><span className="text-brand-red text-[10px] tracking-[3px] font-black">TECHNOLOGIES</span>
                       </div>
                    </div>
                    <p className="text-zinc-600 font-medium text-xs max-w-[280px]">Official attendance and workforce management system for White Gloves Technologies.</p>
                 </div>

                 <div className="grid grid-cols-2 md:grid-cols-3 gap-12 lg:gap-24">
                    <div className="space-y-4">
                       <h5 className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">General</h5>
                       <ul className="space-y-3 text-xs font-medium text-zinc-600">
                          <li className="hover:text-brand-red transition-colors cursor-pointer">About Us</li>
                          <li className="hover:text-brand-red transition-colors cursor-pointer">Support</li>
                          <li className="hover:text-brand-red transition-colors cursor-pointer">Careers</li>
                       </ul>
                    </div>
                    <div className="space-y-4">
                       <h5 className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Connect</h5>
                       <ul className="space-y-3 text-xs font-medium text-zinc-600">
                          <li className="hover:text-brand-red transition-colors cursor-pointer">LinkedIn</li>
                          <li className="hover:text-brand-red transition-colors cursor-pointer">Twitter</li>
                       </ul>
                    </div>
                    <div className="space-y-4">
                       <h5 className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Administration</h5>
                       <Link href="/login" className="flex items-center gap-3 text-zinc-300 font-bold text-xs group hover:text-brand-red transition-all">
                          <div className="w-8 h-8 bg-brand-red/10 border border-brand-red/20 flex items-center justify-center rounded-lg group-hover:bg-brand-red group-hover:border-brand-red transition-all">
                             <Lock size={14} className="text-brand-red group-hover:text-white transition-colors" />
                          </div>
                          Admin Login
                       </Link>
                    </div>
                 </div>
              </div>
              
              <div className="mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                 <div className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest">© 2026 WHITE GLOVES TECHNOLOGIES. ALL RIGHTS RESERVED.</div>
                 <div className="flex gap-8 text-[9px] font-bold uppercase tracking-widest text-zinc-700">
                    <span className="hover:text-white cursor-pointer transition-colors">Privacy</span>
                    <span className="hover:text-white cursor-pointer transition-colors">Terms</span>
                 </div>
              </div>
           </div>
        </footer>
      )}
    </main>
  );
}
