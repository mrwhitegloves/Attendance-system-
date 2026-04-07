"use client";

import React, { useState } from 'react';
import { Shield, User, BadgeCheck, Briefcase, LayoutGrid, ArrowRight } from 'lucide-react';

interface Profile {
  name: string;
  employeeId: string;
  department: string;
  staffType: 'Office Staff' | 'Field Staff';
}

export default function ProfileForm({ onComplete }: { onComplete: (profile: Profile) => void }) {
  const [formData, setFormData] = useState<Profile>({
    name: '',
    employeeId: '',
    department: '',
    staffType: 'Office Staff',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.employeeId) {
      onComplete(formData);
    }
  };

  return (
    <div className="w-full max-w-[480px] bg-brand-card/80 backdrop-blur-2xl border border-brand-border rounded-[40px] p-8 lg:p-12 shadow-2xl relative z-10 animate-fade-in font-sans">
      <div className="text-center space-y-3 mb-10">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-brand-red rounded-2xl flex items-center justify-center shadow-2xl shadow-red-900/30 rotate-6 transition-transform hover:rotate-0 duration-500">
             <Shield size={32} className="text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-black tracking-tighter text-white uppercase italic">Profile Genesis</h2>
        <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest leading-none">Initialize your corporate identity node</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block pl-2" htmlFor="name">Legal Identifier</label>
          <div className="relative group">
            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-brand-red transition-colors" />
            <input
              type="text"
              id="name"
              placeholder="Full Name"
              className="w-full bg-black/50 border border-brand-border rounded-2xl py-4 pl-12 pr-6 outline-none focus:border-brand-red/50 transition-all font-medium text-white text-sm"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block pl-2" htmlFor="employeeId">Badge Sequence</label>
          <div className="relative group">
            <BadgeCheck size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-brand-red transition-colors" />
            <input
              type="text"
              id="employeeId"
              placeholder="e.g. WG-12345"
              className="w-full bg-black/50 border border-brand-border rounded-2xl py-4 pl-12 pr-6 outline-none focus:border-brand-red/50 transition-all font-medium text-white text-sm"
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block pl-2" htmlFor="department">Affiliation</label>
            <div className="relative group">
              <Briefcase size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none group-focus-within:text-brand-red transition-colors" />
              <select
                id="department"
                className="w-full bg-black/50 border border-brand-border rounded-2xl py-4 pl-12 pr-6 outline-none focus:border-brand-red/50 transition-all font-bold text-white text-xs appearance-none"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                required
              >
                <option value="" disabled className="bg-zinc-900 text-zinc-500 text-sm">Select Dept</option>
                {['Engineering', 'Marketing', 'Operations', 'Design', 'HR'].map(dept => (
                   <option key={dept} value={dept} className="bg-zinc-900 text-white text-sm">{dept}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block pl-2" htmlFor="staffType">Strategy</label>
            <div className="relative group">
              <LayoutGrid size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none group-focus-within:text-brand-red transition-colors" />
              <select
                id="staffType"
                className="w-full bg-black/50 border border-brand-border rounded-2xl py-4 pl-12 pr-6 outline-none focus:border-brand-red/50 transition-all font-bold text-white text-xs appearance-none"
                value={formData.staffType}
                onChange={(e) => setFormData({ ...formData, staffType: e.target.value as any })}
                required
              >
                <option value="Office Staff" className="bg-zinc-900 text-white text-sm">Office Node</option>
                <option value="Field Staff" className="bg-zinc-900 text-white text-sm">Field Node</option>
              </select>
            </div>
          </div>
        </div>

        <button type="submit" className="w-full group bg-brand-red text-white py-5 rounded-2xl flex items-center justify-center gap-4 font-black text-lg transition-all hover:bg-red-700 active:scale-95 shadow-2xl shadow-red-900/30">
          Sync Identity 
          <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
        </button>
      </form>
    </div>
  );
}
