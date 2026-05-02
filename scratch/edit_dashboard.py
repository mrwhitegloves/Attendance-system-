import sys
sys.stdout.reconfigure(encoding='utf-8')

# ============================================================
# FIX 1: Admin Dashboard selectedGroupLog modal photo panel
# ============================================================
with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    admin = f.read()

# Fix the photo panel height and object position
OLD_PHOTO_PANEL = '''                  <div
                     className={`relative w-full lg:w-5/12 bg-zinc-900 border-b lg:border-b-0 lg:border-r border-white/5 overflow-hidden shrink-0 ${selectedGroupLog.punchOutSelfie ? 'cursor-pointer' : ''}`}
                     style={{ minHeight: '180px', maxHeight: 'clamp(220px, 45vw, 440px)' }}
                     onClick={() => { if (selectedGroupLog.punchOutSelfie) setActivePhotoTab(p => p === 'in' ? 'out' : 'in'); }}
                  >
                     <div className="relative w-full h-full" style={{ minHeight: 'inherit', maxHeight: 'inherit' }}>'''

NEW_PHOTO_PANEL = '''                  <div
                     className={`relative w-full lg:w-5/12 h-[48vh] lg:h-auto bg-zinc-900 border-b lg:border-b-0 lg:border-r border-white/5 overflow-hidden shrink-0 ${selectedGroupLog.punchOutSelfie ? 'cursor-pointer' : ''}`}
                     onClick={() => { if (selectedGroupLog.punchOutSelfie) setActivePhotoTab(p => p === 'in' ? 'out' : 'in'); }}
                  >
                     <div className="relative w-full h-full">'''

# Also fix object-cover object-top -> object-cover object-center in this modal
if OLD_PHOTO_PANEL in admin:
    admin = admin.replace(OLD_PHOTO_PANEL, NEW_PHOTO_PANEL, 1)
    print('Admin photo panel: OK')
else:
    print('Admin photo panel: MISS')

# Fix object-top to object-center in selectedGroupLog images
admin = admin.replace(
    'alt="Check-in" fill className="object-cover object-top" unoptimized />',
    'alt="Check-in" fill className="object-cover object-center" unoptimized />',
    1
)
admin = admin.replace(
    'alt="Check-out" fill className="object-cover object-top" unoptimized />',
    'alt="Check-out" fill className="object-cover object-center" unoptimized />',
    1
)

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(admin)
print('Admin: saved')

# ============================================================
# FIX 2: Employee AttendanceSystem.tsx selectedDayDetails modal
# Full redesign - bottom-sheet on mobile, side-by-side on desktop
# ============================================================
with open('src/components/AttendanceSystem.tsx', 'r', encoding='utf-8') as f:
    emp = f.read()

OLD_EMP_MODAL = '''      {/* Selected Day Modal */}
      {selectedDayDetails && (
         <div className="fixed inset-0 bg-black/95 z-[2000] flex items-center justify-center p-6 backdrop-blur-3xl animate-fade-in" onClick={() => setSelectedDayDetails(null)}>
            <div className="bg-brand-card border border-white/10 w-full max-w-4xl rounded-[48px] overflow-hidden shadow-3xl flex flex-col lg:flex-row relative" onClick={e => e.stopPropagation()}>
               <button
                  onClick={() => setSelectedDayDetails(null)}
                  className="absolute top-6 right-6 z-50 w-12 h-12 bg-white/5 hover:bg-brand-red text-white rounded-2xl flex items-center justify-center transition-all"
               >
                  <X size={24} />
               </button>

               <div 
                  className={`w-full lg:w-1/2 aspect-square lg:aspect-auto bg-zinc-900 flex flex-col relative border-r border-white/5 ${selectedDayDetails.punchOutSelfie ? 'cursor-pointer group/photo' : ''}`}
                  onClick={() => { if(selectedDayDetails.punchOutSelfie) setActivePhotoTab(p => p === 'in' ? 'out' : 'in'); }}
               >
                  {activePhotoTab === 'in' ? (
                     selectedDayDetails.selfie ? (
                        <div className="relative flex-1 transition-all animate-fade-in">
                           <Image src={selectedDayDetails.selfie} alt="Punch In Selfie" className="w-full h-full object-cover" width={800} height={800} unoptimized />
                           <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                           <div className="absolute bottom-6 sm:bottom-10 left-6 sm:left-10 right-6 sm:right-10">
                              <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                                 Check-in Photo
                                 {selectedDayDetails.punchOutSelfie && <span className="bg-white/10 text-white px-2 py-1 rounded-md text-[8px] group-hover/photo:bg-white/20 transition-all">Click to see Check-Out</span>}
                              </p>
                              <h3 className="text-3xl font-black italic uppercase text-white truncate">{selectedDayDetails.userName}</h3>
                           </div>
                        </div>
                     ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-800 animate-fade-in">
                           <ShieldAlert size={64} />
                           <p className="font-bold text-xs uppercase tracking-widest">No Check-in Photo</p>
                        </div>
                     )
                  ) : (
                     <div className="relative flex-1 transition-all animate-fade-in">
                        <Image src={selectedDayDetails.punchOutSelfie} alt="Punch Out Selfie" className="w-full h-full object-cover" width={800} height={800} unoptimized />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                        <div className="absolute bottom-6 sm:bottom-10 left-6 sm:left-10 right-6 sm:right-10">
                           <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                              Check-out Photo
                              {selectedDayDetails.selfie && <span className="bg-white/10 text-white px-2 py-1 rounded-md text-[8px] group-hover/photo:bg-white/20 transition-all">Click to see Check-In</span>}
                           </p>
                           <h3 className="text-3xl font-black italic uppercase text-white truncate">{selectedDayDetails.userName}</h3>
                        </div>
                     </div>
                  )}
               </div>

               <div className="p-10 lg:p-14 flex-grow flex flex-col justify-between space-y-10">
                  <div className="space-y-8">
                     <div className="flex justify-between items-start">
                        <div>
                           <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-2">{new Date(selectedDayDetails.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                           <div className="text-3xl font-black italic uppercase text-white leading-none">Record Log</div>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-8">
                        <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                           <p className="text-[9px] font-black text-green-500 uppercase tracking-widest mb-2">Punch In</p>
                           <div className="text-2xl font-black text-white">{selectedDayDetails.punchIn || '--:--'}</div>
                        </div>
                        <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                           <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-2">Punch Out</p>
                           <div className="text-2xl font-black text-white">{selectedDayDetails.punchOut || '--:--'}</div>
                        </div>
                     </div>

                     <div className="space-y-3">
                        <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest pl-1">Location</p>
                        <div className="bg-white/5 rounded-3xl p-6 border border-white/5 flex items-start gap-4">
                           <div className="w-10 h-10 bg-brand-red/10 rounded-xl flex items-center justify-center shrink-0">
                              <MapPin size={20} className="text-brand-red" />
                           </div>
                           <div>
                              <p className="text-sm text-zinc-300 font-bold leading-relaxed">{selectedDayDetails.location || 'N/A'}</p>
                           </div>
                        </div>
                     </div>

                     {selectedDayDetails.remark && (
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-3xl p-6 flex flex-col items-start gap-2">
                           <div className="flex items-center gap-2">
                              <Activity size={16} className="text-orange-500" />
                              <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">System Note</span>
                           </div>
                           <p className="text-sm font-bold text-orange-400 leading-relaxed">{selectedDayDetails.remark}</p>
                        </div>
                     )}
                  </div>
               </div>
            </div>
         </div>
      )}'''

NEW_EMP_MODAL = '''      {/* Selected Day Modal \u2014 responsive bottom-sheet (mobile) / side-by-side (desktop) */}
      {selectedDayDetails && (
         <div
            className="fixed inset-0 bg-black/95 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4 lg:p-6 backdrop-blur-3xl animate-fade-in"
            onClick={() => setSelectedDayDetails(null)}
         >
            <div
               className="bg-brand-card border border-white/10 w-full sm:max-w-4xl rounded-t-[36px] sm:rounded-[44px] overflow-hidden shadow-3xl flex flex-col lg:flex-row relative max-h-[92vh] sm:max-h-[88vh]"
               onClick={e => e.stopPropagation()}
            >
               {/* Always-visible close button */}
               <button
                  onClick={() => setSelectedDayDetails(null)}
                  className="absolute top-4 right-4 z-50 w-10 h-10 sm:w-12 sm:h-12 bg-black/60 hover:bg-brand-red text-white rounded-2xl flex items-center justify-center transition-all border border-white/10 backdrop-blur-sm shadow-xl"
               >
                  <X size={20} />
               </button>

               {/* Photo Panel \u2014 tall on mobile, half-width on desktop */}
               <div
                  className={`relative w-full lg:w-1/2 h-[48vh] lg:h-auto bg-zinc-900 border-b lg:border-b-0 lg:border-r border-white/5 overflow-hidden shrink-0 ${selectedDayDetails.punchOutSelfie ? 'cursor-pointer' : ''}`}
                  onClick={() => { if(selectedDayDetails.punchOutSelfie) setActivePhotoTab(p => p === 'in' ? 'out' : 'in'); }}
               >
                  <div className="relative w-full h-full">
                     {activePhotoTab === 'in' ? (
                        selectedDayDetails.selfie ? (
                           <>
                              <Image src={selectedDayDetails.selfie} alt="Punch In Selfie" fill className="object-cover object-center" unoptimized />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                              <div className="absolute bottom-4 left-5 right-14">
                                 <p className="text-[9px] font-black text-green-400 uppercase tracking-widest mb-0.5">Check-in Photo</p>
                                 <h3 className="text-xl sm:text-2xl font-black italic uppercase text-white truncate">{selectedDayDetails.userName}</h3>
                                 {selectedDayDetails.punchOutSelfie && (
                                    <span className="inline-block mt-1 bg-white/10 text-white/60 px-2 py-0.5 rounded text-[8px] font-bold">Tap \u2192 Check-Out</span>
                                 )}
                              </div>
                           </>
                        ) : (
                           <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-zinc-800">
                              <ShieldAlert size={56} />
                              <p className="text-xs font-black uppercase tracking-widest">No Check-in Photo</p>
                              <p className="text-base font-black text-white/20 uppercase italic truncate max-w-[80%]">{selectedDayDetails.userName}</p>
                           </div>
                        )
                     ) : (
                        <>
                           <Image src={selectedDayDetails.punchOutSelfie} alt="Punch Out Selfie" fill className="object-cover object-center" unoptimized />
                           <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                           <div className="absolute bottom-4 left-5 right-14">
                              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Check-out Photo</p>
                              <h3 className="text-xl sm:text-2xl font-black italic uppercase text-white truncate">{selectedDayDetails.userName}</h3>
                              {selectedDayDetails.selfie && (
                                 <span className="inline-block mt-1 bg-white/10 text-white/60 px-2 py-0.5 rounded text-[8px] font-bold">Tap \u2192 Check-In</span>
                              )}
                           </div>
                        </>
                     )}
                  </div>
               </div>

               {/* Details Panel \u2014 scrollable */}
               <div className="flex-grow overflow-y-auto p-5 sm:p-8 lg:p-10 space-y-4 scrollbar-hide">
                  {/* Date + status */}
                  <div className="flex items-center justify-between">
                     <div>
                        <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">
                           {new Date(selectedDayDetails.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <div className="text-xl sm:text-2xl font-black italic uppercase text-white leading-tight">Record Log</div>
                     </div>
                  </div>

                  {/* Punch times */}
                  <div className="grid grid-cols-2 gap-3">
                     <div className="bg-green-500/10 border border-green-500/10 rounded-2xl p-4">
                        <p className="text-[9px] font-black text-green-500 uppercase tracking-widest mb-1">Punch In</p>
                        <div className="text-xl sm:text-2xl font-black text-white">{selectedDayDetails.punchIn || '--:--'}</div>
                     </div>
                     <div className="bg-red-500/10 border border-red-500/10 rounded-2xl p-4">
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Punch Out</p>
                        <div className="text-xl sm:text-2xl font-black text-white">{selectedDayDetails.punchOut || '--:--'}</div>
                     </div>
                  </div>

                  {/* Location */}
                  {selectedDayDetails.location && (
                     <div className="bg-white/5 rounded-2xl p-4 flex items-start gap-3">
                        <div className="w-8 h-8 bg-brand-red/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                           <MapPin size={14} className="text-brand-red" />
                        </div>
                        <div className="min-w-0">
                           <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Location</p>
                           <p className="text-sm text-zinc-300 font-bold leading-relaxed break-words">{selectedDayDetails.location}</p>
                        </div>
                     </div>
                  )}

                  {/* System Note */}
                  {selectedDayDetails.remark && (
                     <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                           <Activity size={12} className="text-orange-500" />
                           <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">System Note</span>
                        </div>
                        <p className="text-xs font-bold text-orange-400 leading-relaxed">{selectedDayDetails.remark}</p>
                     </div>
                  )}

                  {/* Close tap target for mobile */}
                  <button
                     onClick={() => setSelectedDayDetails(null)}
                     className="lg:hidden w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-black uppercase tracking-widest text-zinc-500 active:bg-white/10 transition-all"
                  >
                     \u2190 Close
                  </button>
               </div>
            </div>
         </div>
      )}'''

if OLD_EMP_MODAL in emp:
    emp = emp.replace(OLD_EMP_MODAL, NEW_EMP_MODAL, 1)
    print('Employee modal: OK')
else:
    print('Employee modal: MISS')
    idx = emp.find('Selected Day Modal')
    print(f'Marker at: {idx}')

with open('src/components/AttendanceSystem.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(emp)
print('Employee: saved')
