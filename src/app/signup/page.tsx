"use client";

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowRight } from 'lucide-react';

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-brand-red selection:text-white">
      {/* Visual Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-brand-red/10 blur-[150px] rounded-full"></div>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#e61e2a 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      <div className="w-full max-w-[440px] bg-brand-card/80 backdrop-blur-2xl border border-brand-border rounded-[32px] p-12 text-center space-y-6 relative z-10 animate-fade-in shadow-2xl">
        <div className="flex justify-center">
            <div className="w-20 h-20 bg-brand-red/10 border border-brand-red/20 rounded-3xl flex items-center justify-center shadow-red-900/10">
               <ShieldAlert size={40} className="text-brand-red" />
            </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-black italic uppercase tracking-tight text-white underline decoration-brand-red decoration-4">Access Restricted</h1>
          <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest">Enterprise Security Policy</p>
        </div>

        <p className="text-zinc-400 font-bold text-sm leading-relaxed px-2">
          Self-registration is currently disabled. All employee nodes are now provisioned directly through the Management Command Center. <br/><br/>
          Please contact your administrator to obtain your unique <span className="text-brand-red font-black">MWG-ID</span> and verified credentials.
        </p>

        <div className="pt-4">
           <Link href="/login" className="flex items-center justify-center gap-3 bg-brand-red hover:bg-red-700 text-white font-black py-4 px-8 rounded-2xl transition-all uppercase text-[10px] tracking-widest shadow-xl shadow-red-900/20 active:scale-95 group">
              Return to Control Center
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
           </Link>
        </div>
      </div>
    </div>
  );
}
