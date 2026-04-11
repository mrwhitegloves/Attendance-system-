"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
   Users,
   MapPin,
   Activity,
   Calendar as CalendarIcon,
   Download,
   Search,
   LogOut,
   CheckCircle2,
   X,
   Menu,
   Clock,
   ExternalLink,
   ChevronLeft,
   ChevronRight,
   Check,
   XCircle,
   FileText,
   UserPlus,
   Pencil,
   Trash2,
   Lock,
   Smartphone,
   ShieldAlert,
   Save,
   Plus,
   RefreshCcw,
   Bell
} from 'lucide-react';
import Loader from './Loader';

interface AttendanceLog {
   _id: string;
   userId?: any;
   employeeId: string;
   date: string;
   time: string;
   status: string;
   location: string;
   selfie: string | null;
   lat?: number;
   lon?: number;
   userName?: string;
}

interface UserProfile {
   _id: string;
   email: string;
   name: string;
   employeeId: string;
   department: string;
   phone?: string;
   staffType?: string;
   isAdmin?: boolean;
   password?: string;
   expectedInTime?: string;
   expectedOutTime?: string;
}

interface LeaveRequest {
   _id: string;
   userId?: any;
   employeeId: string;
   employeeName: string;
   startDate: string;
   endDate: string;
   reason: string;
   status: 'pending' | 'approved' | 'rejected';
   adminNote?: string;
   processedAt?: string | Date;
}

export default function AdminDashboard({ profile }: { profile: any }) {
   const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'leaves' | 'users'>('dashboard');
   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
   const [search, setSearch] = useState('');
   const [logs, setLogs] = useState<AttendanceLog[]>([]);
   const [workforce, setWorkforce] = useState<UserProfile[]>([]);
   const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
   const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
   const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());

   // User Management State
   const [showAddUserModal, setShowAddUserModal] = useState(false);
   const [isEditingUser, setIsEditingUser] = useState<UserProfile | null>(null);
   const [newUser, setNewUser] = useState({ name: '', phone: '', email: '', password: '', department: 'Field Staff', staffType: 'Field Staff', isAdmin: false, expectedInTime: '09:30', expectedOutTime: '18:30' });
   const [selectedGroupLog, setSelectedGroupLog] = useState<any>(null);
   const [selectedDayDetails, setSelectedDayDetails] = useState<any>(null);
   const [logPage, setLogPage] = useState(1);
   const logsPerPage = 10;
   const [isLoading, setIsLoading] = useState(true);
   const [isActionLoading, setIsActionLoading] = useState(false);

   // Notification State
   const [notificationPermission, setNotificationPermission] = useState('default');
   const prevPendingCount = useRef<number | null>(null);

   useEffect(() => {
      if ("Notification" in window) {
         Notification.requestPermission().then(status => setNotificationPermission(status));
      }
   }, []);

   useEffect(() => {
      const pending = leaves.filter(l => l.status === 'pending');
      const currentCount = pending.length;

      // Only notify if we have a previous count (prevents notification on first load)
      if (prevPendingCount.current !== null && currentCount > prevPendingCount.current) {
         const newest = pending[0]; // Assuming newest is first due to sort
         if (newest && notificationPermission === 'granted') {
            new Notification("New Leave Petition", {
               body: `${newest.employeeName} has requested leave for ${newest.startDate}`,
               icon: '/logo.png',
               tag: 'leave-req' // Prevent duplicate alerts for the same batch
            });
         }
      }
      prevPendingCount.current = currentCount;
   }, [leaves, notificationPermission]);

   const fetchData = async () => {
      setIsLoading(true);
      try {
         const [lRes, wRes, lvRes] = await Promise.all([
            fetch('/api/attendance'), // Fetch all for now to support calendar too
            fetch('/api/users'),
            fetch('/api/leaves')
         ]);
         if (lRes.ok) {
            const data = await lRes.json();
            console.log("Admin Data Fetch (Logs):", data);
            setLogs(data);
         }
         if (wRes.ok) setWorkforce(await wRes.json());
         if (lvRes.ok) setLeaves(await lvRes.json());
      } catch (err) { console.error('Error fetching data:', err); }
      finally { setIsLoading(false); }
   };

   useEffect(() => {
      fetchData();
      const interval = setInterval(() => {
         if (document.visibilityState === 'visible') {
            fetchData();
         }
      }, 15000); // 15s heartbeat
      return () => clearInterval(interval);
   }, []);

   const handleLeaveAction = async (id: string, action: 'approved' | 'rejected') => {
      const adminNote = prompt(`Enter administrative reason for ${action.toUpperCase()}:`) || '';
      setIsActionLoading(true);
      try {
         const res = await fetch('/api/leaves', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: action, adminNote })
         });
         if (res.ok) fetchData();
      } catch (err) { console.error('Error updating leave:', err); }
      finally { setIsActionLoading(false); }
   };

   const handleCreateUser = async () => {
      if (!newUser.name || !newUser.password) return alert("Fill required fields");
      setIsActionLoading(true);
      try {
         const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser)
         });
         if (res.ok) {
            alert("User created successfully!");
            setShowAddUserModal(false);
            setNewUser({ name: '', phone: '', email: '', password: '', department: 'Field Staff', staffType: 'Field Staff', isAdmin: false, expectedInTime: '09:30', expectedOutTime: '18:30' });
            fetchData();
         } else {
            const err = await res.json();
            alert(err.error || "Creation failed");
         }
      } catch (err) { console.error(err); }
      finally { setIsActionLoading(false); }
   };

   const handleUpdateUser = async () => {
      if (!isEditingUser) return;
      setIsActionLoading(true);
      try {
         const res = await fetch('/api/users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: isEditingUser._id, ...isEditingUser })
         });
         if (res.ok) {
            alert("User updated successfully!");
            setIsEditingUser(null);
            fetchData();
         }
      } catch (err) { console.error(err); }
      finally { setIsActionLoading(false); }
   };

   const handleDeleteUser = async (id: string) => {
      if (!confirm("Are you sure you want to delete this user?")) return;
      setIsActionLoading(true);
      try {
         const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
         if (res.ok) fetchData();
      } catch (err) { console.error(err); }
      finally { setIsActionLoading(false); }
   };

   // Group Today's Logs by User with Search filtering
   const now = new Date();
   const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

   const parseTime = (t: string) => {
      if (!t || typeof t !== 'string') return 0;
      const parts = t.split(' ');
      if (parts.length < 2) return 0;
      const [time, modifier] = parts;
      let [hours, minutes] = time.split(':').map(Number);
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
   };

   const groupedTodayLogs = (() => {
      const groups: { [key: string]: any } = {};
      const filteredLogs = logs.filter(l => l.date === todayStr);

      filteredLogs.forEach(log => {
         // Robust name finding: Prefer specific names over generic 'Unknown User'
         const baseName = (log.userName && log.userName !== 'Unknown User')
            ? log.userName
            : (workforce.find(w => w.employeeId === log.employeeId || w._id === (log.userId?._id || log.userId))?.name || 'Unknown User');

         if (search && !baseName.toLowerCase().includes(search.toLowerCase()) && !log.employeeId.toLowerCase().includes(search.toLowerCase())) return;

         if (!groups[log.employeeId]) {
            groups[log.employeeId] = {
               userId: log.userId,
               employeeId: log.employeeId,
               userName: baseName,
               punchIn: null,
               punchOut: null,
               punchInStatus: null,
               latestSelfie: log.selfie,
               latestLocation: log.location,
               lat: log.lat,
               lon: log.lon,
               allLogs: []
            };
         }
         groups[log.employeeId].allLogs.push(log);

         const logTimeVal = parseTime(log.time);

         if (log.status === 'Checked In' || log.status === 'Late') {
            const currentInVal = parseTime(groups[log.employeeId].punchIn);
            if (!groups[log.employeeId].punchIn || logTimeVal < currentInVal) {
               groups[log.employeeId].punchIn = log.time;
               groups[log.employeeId].punchInStatus = log.status;
            }
         }

         if (log.status === 'Checked Out') {
            const currentOutVal = parseTime(groups[log.employeeId].punchOut);
            if (!groups[log.employeeId].punchOut || logTimeVal > currentOutVal) {
               groups[log.employeeId].punchOut = log.time;
            }
         }

         if (log.selfie && !groups[log.employeeId].latestSelfie) groups[log.employeeId].latestSelfie = log.selfie;
         if (!groups[log.employeeId].latestLocation) groups[log.employeeId].latestLocation = log.location;
      });
      return Object.values(groups).sort((a: any, b: any) => parseTime(a.punchIn) - parseTime(b.punchIn));
   })();

   const calculateHours = (inTime: string | null, outTime: string | null) => {
      if (!inTime || !outTime) return '--';
      try {
         const parse = (t: string) => {
            const [time, modifier] = t.split(' ');
            let [hours, minutes] = time.split(':').map(Number);
            if (modifier === 'PM' && hours < 12) hours += 12;
            if (modifier === 'AM' && hours === 12) hours = 0;
            return hours * 60 + minutes;
         };
         const diff = parse(outTime) - parse(inTime);
         if (diff < 0) return '--';
         const h = Math.floor(diff / 60);
         const m = diff % 60;
         return `${h}h ${m}m`;
      } catch { return '--'; }
   };

   const getDaysInMonth = (month: Date) => {
      const year = month.getFullYear();
      const m = month.getMonth();
      const days = new Date(year, m + 1, 0).getDate();
      const firstDay = new Date(year, m, 1).getDay();
      return { days, firstDay };
   };

   const renderCalendar = (user: UserProfile) => {
      const { days, firstDay } = getDaysInMonth(currentCalendarMonth);
      const userLogs = logs.filter(l => l.employeeId === user.employeeId);
      const monthYearStr = currentCalendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
      const currentMonthIdx = currentCalendarMonth.getMonth();
      const currentYear = currentCalendarMonth.getFullYear();

      let presentDays = 0, leaveDays = 0, lateDays = 0;
      const calendarGrid = [];
      for (let i = 0; i < firstDay; i++) calendarGrid.push(<div key={`empty-${i}`} />);

      for (let d = 1; d <= days; d++) {
         const dStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
         const dayLogs = userLogs.filter(l => l.date === dStr);

         const isPresent = dayLogs.some(l => l.status === 'Checked In' || l.status === 'Checked Out' || l.status === 'Late');
         const isLate = dayLogs.some(l => l.status === 'Late');
         const isLeave = dayLogs.some(l => l.status === 'Leave');
         const isPendingLeave = leaves.some(l =>
            (l.employeeId === user.employeeId || l.userId === user._id) &&
            (l.status === 'pending') &&
            dStr >= l.startDate && dStr <= l.endDate
         );

         if (isPresent) presentDays++;
         if (isLate) lateDays++;
         if (isLeave) leaveDays++;

         const punchIn = dayLogs.find(l => l.status === 'Checked In' || l.status === 'Late')?.time || '--:--';
         const punchOut = dayLogs.find(l => l.status === 'Checked Out')?.time || '--:--';
         const status = isPendingLeave ? 'Pending' : (isLate ? 'Late' : isPresent ? 'On-Time' : isLeave ? 'Leave' : 'Absent');

         calendarGrid.push(
            <div
               key={d}
               onClick={() => setSelectedDayDetails({ date: dStr, punchIn, punchOut, status })}
               className={`aspect-square border border-white/5 flex flex-col items-center justify-center relative rounded-xl cursor-pointer transition-all hover:scale-105 active:scale-95 group ${isPendingLeave ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse' :
                     isLate ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                        isPresent ? 'bg-green-500/10 text-green-500' :
                           isLeave ? 'bg-red-500/10 text-red-500' :
                              'bg-zinc-900/40 text-zinc-700'
                  }`}
            >
               <span className="text-sm font-bold">{d}</span>
               {isLate && <div className="absolute bottom-1 w-1.5 h-1.5 bg-orange-500 rounded-full" />}
               {isPresent && !isLate && <div className="absolute bottom-1 w-1.5 h-1.5 bg-green-500 rounded-full" />}
               {isLeave && <div className="absolute bottom-1 w-1.5 h-1.5 bg-red-500 rounded-full" />}
               <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 rounded-xl transition-all"></div>
            </div>
         );
      }

      return (
         <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
               <button onClick={() => setSelectedUser(null)} className="flex items-center gap-2 text-zinc-500 hover:text-white"><ChevronLeft size={20} /> Back</button>
               <div className="flex items-center gap-4">
                  <button onClick={() => setCurrentCalendarMonth(new Date(currentYear, currentMonthIdx - 1))}><ChevronLeft size={20} /></button>
                  <h3 className="text-xl font-bold italic uppercase">{monthYearStr}</h3>
                  <button onClick={() => setCurrentCalendarMonth(new Date(currentYear, currentMonthIdx + 1))}><ChevronRight size={20} /></button>
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-3xl shadow-lg shadow-green-900/5">
                  <div className="flex items-center gap-3 mb-2">
                     <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                     <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Present</p>
                  </div>
                  <h4 className="text-4xl font-black">{presentDays} <small className="text-lg font-bold opacity-50">Days</small></h4>
               </div>
               <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl shadow-lg shadow-red-900/5">
                  <div className="flex items-center gap-3 mb-2">
                     <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                     <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Leaves</p>
                  </div>
                  <h4 className="text-4xl font-black">{leaveDays} <small className="text-lg font-bold opacity-50">Days</small></h4>
               </div>
               <div className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-3xl shadow-lg shadow-orange-900/5">
                  <div className="flex items-center gap-3 mb-2">
                     <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                     <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Late Days</p>
                  </div>
                  <h4 className="text-4xl font-black">{lateDays} <small className="text-lg font-bold opacity-50">Late</small></h4>
               </div>
            </div>
            <div className="bg-zinc-900/20 border border-white/5 p-6 rounded-[32px] grid grid-cols-7 gap-2 shadow-inner">
               {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="text-center text-[10px] font-black text-zinc-700 uppercase p-2">{d}</div>)}
               {calendarGrid}
            </div>

            {/* Calendar Day Detail Popup */}
            {selectedDayDetails && (
               <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[1000] flex items-center justify-center p-6" onClick={() => setSelectedDayDetails(null)}>
                  <div className="bg-brand-card border border-white/10 p-8 rounded-[40px] w-full max-w-xs space-y-6 shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
                     <div className="flex justify-between items-center">
                        <h4 className="text-lg font-black uppercase italic tracking-wider">Day Details</h4>
                        <button onClick={() => setSelectedDayDetails(null)} className="p-2 hover:bg-white/5 rounded-xl transition-all"><X size={20} /></button>
                     </div>
                     <div className="space-y-4">
                        <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                           <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Date</p>
                           <p className="font-bold text-sm tracking-tight">{new Date(selectedDayDetails.date).toLocaleDateString('en-GB')}</p>
                        </div>
                        <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                           <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Start Node</p>
                           <p className={`font-bold text-sm tracking-tight ${selectedDayDetails.status === 'Late' ? 'text-orange-500' : 'text-green-500'}`}>{selectedDayDetails.punchIn}</p>
                        </div>
                        <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                           <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Exit Node</p>
                           <p className={`font-bold text-sm tracking-tight ${selectedDayDetails.punchOut !== '--:--' ? 'text-red-500' : 'text-zinc-600'}`}>{selectedDayDetails.punchOut}</p>
                        </div>
                        <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                           <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Operational Status</p>
                           <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md tracking-tighter ${selectedDayDetails.status === 'Late' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' :
                                 selectedDayDetails.status === 'On-Time' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                    selectedDayDetails.status === 'Leave' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                       'bg-zinc-800 text-zinc-500'
                              }`}>{selectedDayDetails.status}</span>
                        </div>
                     </div>
                     <button onClick={() => setSelectedDayDetails(null)} className="w-full py-4 bg-brand-red text-white shadow-xl shadow-red-900/30 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95">Dismiss</button>
                  </div>
               </div>
            )}
         </div>
      );
   };

   return (
      <div className="min-h-screen bg-black text-white flex relative overflow-hidden font-sans selection:bg-brand-red">
         {/* Sidebar */}
         <aside className="hidden lg:flex w-72 bg-brand-card/80 backdrop-blur-2xl border-r border-brand-border flex-col p-8 sticky top-0 h-screen z-50">
            <div className="flex items-center gap-4 mb-12">
               <div className="w-10 h-10 bg-brand-red rounded-xl flex items-center justify-center p-1 shadow-lg shadow-red-900/30">
                  <Image src="/logo.png" alt="MWG" width={32} height={32} className="rounded-lg" />
               </div>
               <div className="leading-tight">
                  <strong className="text-xl font-bold tracking-tight">Admin CMS</strong>
                  <p className="text-[9px] text-zinc-600 font-black tracking-widest uppercase">MWG ACCESS</p>
               </div>
            </div>

            <nav className="flex-grow flex flex-col gap-2">
               {[
                  { id: 'dashboard', icon: Activity, label: 'Logs' },
                  { id: 'employees', icon: Users, label: 'Attendance' },
                  { id: 'leaves', icon: FileText, label: 'Applications' },
                  { id: 'users', icon: ShieldAlert, label: 'Manage Users' }
               ].map(item => (
                  <div key={item.id} onClick={() => { setActiveTab(item.id as any); setSelectedUser(null); }} className={`flex items-center gap-4 px-6 py-5 rounded-2xl cursor-pointer transition-all ${activeTab === item.id ? 'bg-brand-red text-white shadow-2xl shadow-red-900/30' : 'hover:bg-white/5 text-zinc-500 hover:text-white'}`}>
                     <item.icon size={20} className={activeTab === item.id ? 'text-white' : ''} />
                     <span className="font-bold text-sm tracking-tight">{item.label}</span>
                  </div>
               ))}
            </nav>
            <button onClick={() => { localStorage.removeItem('user'); window.location.reload(); }} className="flex items-center gap-4 text-zinc-600 hover:text-white font-bold px-2 text-sm mt-auto"><LogOut size={18} /> Exit</button>
         </aside>

         <div className="flex-grow flex flex-col relative z-base max-h-screen overflow-hidden">
            {/* Mobile Header */}
            <header className="lg:hidden sticky top-0 z-[100] flex items-center justify-between px-6 py-4 bg-black/95 border-b border-white/5">
               <div className="flex items-center gap-3">
                  <Image src="/logo.png" alt="MWG" width={32} height={32} />
                  <span className="font-bold text-sm uppercase tracking-widest">Admin Control</span>
               </div>
               <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="w-10 h-10 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center"><Menu size={20} /></button>

               {mobileMenuOpen && (
                  <div className="absolute top-full left-0 right-0 bg-brand-card border-b border-white/10 p-6 space-y-4 shadow-3xl">
                     {['dashboard', 'employees', 'leaves', 'users'].map(t => (
                        <button key={t} onClick={() => { setActiveTab(t as any); setMobileMenuOpen(false); setSelectedUser(null); }} className={`w-full py-5 rounded-xl font-black text-xs uppercase tracking-widest capitalize ${activeTab === t ? 'bg-brand-red text-white' : 'text-zinc-500 bg-white/5'}`}>{t}</button>
                     ))}
                     <button onClick={() => { localStorage.removeItem('user'); window.location.reload(); }} className="w-full py-4 text-zinc-500 font-bold text-sm border-t border-white/5 mt-4 pt-4">Logout</button>
                  </div>
               )}
            </header>

            {/* Desktop Header */}
            <header className="hidden lg:flex sticky top-0 z-40 items-center justify-between px-10 py-6 bg-black/80 border-b border-white/5">
               <div className="bg-zinc-900/50 border border-white/5 px-6 py-3 rounded-2xl flex items-center gap-4 w-[400px]">
                  <Search size={18} className="text-zinc-700" />
                  <input type="text" placeholder="Search records..." className="bg-transparent border-none outline-none text-sm w-full text-zinc-300" value={search} onChange={(e) => setSearch(e.target.value)} />
               </div>
               <div className="flex items-center gap-6">
                  <div className="text-right">
                     <div className="text-sm font-bold">Administrator</div>
                     <div className="text-[10px] font-bold text-brand-red uppercase tracking-widest">System Manager</div>
                  </div>
                  <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center font-bold text-brand-red">A</div>
               </div>
            </header>

            <main className="flex-grow p-6 lg:p-10 overflow-y-auto bg-black scrollbar-hide">
               {activeTab === 'dashboard' && (
                  <div className="space-y-10 animate-fade-in">
                     <h2 className="text-2xl lg:text-3xl font-black italic uppercase underline decoration-brand-red decoration-4">Real-time Logs</h2>
                     
                     {/* Desktop Table View */}
                     <div className="hidden lg:block vfx-card !bg-brand-card/20 rounded-[40px] border-white/5 overflow-hidden">
                        <table className="w-full text-left">
                           <thead>
                              <tr className="bg-white/5 border-b border-white/5 text-[10px] font-black text-zinc-700 uppercase">
                                 <th className="px-8 py-5">Full Node Info</th>
                                 <th className="px-8 py-5">Last Proof</th>
                                 <th className="px-8 py-5">Tracking Node</th>
                                 <th className="px-8 py-5">Shift Time</th>
                              </tr>
                           </thead>
                           <tbody className="text-sm">
                              {isLoading ? (
                                 <tr><td colSpan={4} className="px-8 py-20 text-center"><Loader className="mx-auto" /><p className="text-zinc-700 font-black uppercase text-[10px] tracking-[4px] mt-6">Decoding Node signals...</p></td></tr>
                              ) : groupedTodayLogs.length === 0 ? (
                                 <tr><td colSpan={4} className="px-8 py-20 text-center text-zinc-800 font-black uppercase text-xs italic tracking-widest">No Signals Detected for {todayStr}</td></tr>
                              ) : groupedTodayLogs.slice((logPage - 1) * logsPerPage, logPage * logsPerPage).map((log, i) => (
                                 <tr key={i} onClick={() => setSelectedGroupLog(log)} className="border-b border-white/5 hover:bg-white/5 cursor-pointer group transition-colors">
                                    <td className="px-8 py-6">
                                       <div className="font-bold text-white group-hover:text-brand-red transition-colors">{log.userName}</div>
                                       <div className="text-[10px] text-zinc-600 font-bold uppercase">{log.userId?.mwgId || log.employeeId || 'N/A'}</div>
                                    </td>
                                    <td className="px-8 py-6">
                                       <div className="w-12 h-12 bg-zinc-900 rounded-xl overflow-hidden border border-white/5 shadow-2xl transition-transform group-hover:scale-110">
                                          {log.latestSelfie ? (
                                             <Image src={log.latestSelfie} alt="Proof" className="w-full h-full object-cover" width={48} height={48} unoptimized />
                                          ) : (
                                             <div className="w-full h-full flex items-center justify-center text-zinc-800"><Activity size={18} /></div>
                                          )}
                                       </div>
                                    </td>
                                    <td className="px-8 py-6">
                                       <div className="text-zinc-400 font-bold text-[11px] truncate max-w-[200px] flex items-center gap-2"><MapPin size={12} className="text-brand-red" /> {log.latestLocation}</div>
                                       <div className="text-[9px] text-zinc-700 font-black uppercase mt-1">Live Sync Tracked</div>
                                    </td>
                                    <td className="px-8 py-6">
                                       <div className="flex items-center gap-4">
                                          <div className="flex flex-col">
                                             <span className="text-[9px] font-black text-zinc-700 uppercase">In</span>
                                             <div className="flex items-center gap-1.5"><span className={`text-sm font-black ${log.punchInStatus === 'Late' ? 'text-brand-red' : 'text-green-500'}`}>{log.punchIn || '--:--'}</span>{log.punchInStatus === 'Late' && <span className="text-[8px] bg-brand-red/10 text-brand-red px-1 rounded font-black tracking-tighter shadow-sm shadow-red-900/10">LATE</span>}</div>
                                          </div>
                                          <div className="w-px h-6 bg-white/5"></div>
                                          <div className="flex flex-col">
                                             <span className="text-[9px] font-black text-zinc-700 uppercase">Out</span>
                                             <span className={`text-sm font-black ${log.punchOut ? 'text-green-500' : 'text-zinc-800'}`}>{log.punchOut || '--:--'}</span>
                                          </div>
                                       </div>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>

                     {/* Mobile Card View */}
                     <div className="lg:hidden grid grid-cols-1 gap-4">
                        {isLoading ? (
                           <div className="px-8 py-20 text-center"><Loader className="mx-auto" /><p className="text-zinc-700 font-black uppercase text-[10px] tracking-widest mt-4">Syncing Ops Panel...</p></div>
                        ) : groupedTodayLogs.length === 0 ? (
                           <div className="px-8 py-20 text-center text-zinc-800 font-black uppercase text-xs italic tracking-widest">No Signals Detected for {todayStr}</div>
                        ) : groupedTodayLogs.slice((logPage - 1) * logsPerPage, logPage * logsPerPage).map((log, i) => (
                           <div key={i} onClick={() => setSelectedGroupLog(log)} className="bg-brand-card/40 border border-brand-border p-5 rounded-[24px] space-y-4 active:scale-[0.98] transition-all">
                              <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-zinc-900 rounded-xl overflow-hidden border border-white/5">
                                       {log.latestSelfie ? (
                                          <Image src={log.latestSelfie} alt="Proof" className="w-full h-full object-cover" width={48} height={48} />
                                       ) : (
                                          <div className="w-full h-full flex items-center justify-center text-zinc-800"><Activity size={18} /></div>
                                       )}
                                    </div>
                                    <div>
                                       <div className="font-bold text-white text-sm">{log.userName}</div>
                                       <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">{log.employeeId}</div>
                                    </div>
                                 </div>
                                 <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${log.punchOut ? 'bg-green-500/10 text-green-500' : 'bg-brand-red/10 text-brand-red'}`}>
                                    {log.punchOut ? 'Complete' : 'Active'}
                                 </div>
                              </div>
                              <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl">
                                 <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-zinc-700 uppercase">Punch In</span>
                                    <span className={`text-sm font-black ${log.punchInStatus === 'Late' ? 'text-brand-red' : 'text-green-500'}`}>{log.punchIn || '--:--'}</span>
                                 </div>
                                 <div className="w-px h-6 bg-white/10"></div>
                                 <div className="flex flex-col text-right">
                                    <span className="text-[8px] font-black text-zinc-700 uppercase">Punch Out</span>
                                    <span className={`text-sm font-black ${log.punchOut ? 'text-white' : 'text-zinc-800'}`}>{log.punchOut || '--:--'}</span>
                                 </div>
                              </div>
                              <div className="text-zinc-500 font-bold text-[10px] flex items-center gap-2 px-1">
                                 <MapPin size={12} className="text-brand-red shrink-0" /> 
                                 <span className="truncate">{log.latestLocation}</span>
                              </div>
                           </div>
                        ))}
                     </div>


                     {/* Dashboard Pagination */}
                     {groupedTodayLogs.length > logsPerPage && (
                        <div className="flex items-center justify-center gap-4 pt-4">
                           <button onClick={() => setLogPage(p => Math.max(1, p - 1))} className="px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"><ChevronLeft size={16} /></button>
                           <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Page {logPage} of {Math.ceil(groupedTodayLogs.length / logsPerPage)}</span>
                           <button onClick={() => setLogPage(p => Math.min(Math.ceil(groupedTodayLogs.length / logsPerPage), p + 1))} className="px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"><ChevronRight size={16} /></button>
                        </div>
                     )}
                  </div>
               )}

               {activeTab === 'employees' && (
                  <div className="space-y-10 animate-fade-in">
                     {!selectedUser ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                           {workforce.filter(w => w.name.toLowerCase().includes(search.toLowerCase()) || w.employeeId.includes(search)).map((emp, i) => (
                              <div key={i} onClick={() => setSelectedUser(emp)} className="bg-brand-card/40 border border-brand-border p-6 rounded-[32px] hover:border-brand-red cursor-pointer text-center group">
                                 <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center font-black mx-auto mb-4 group-hover:bg-brand-red transition-all">{emp.name.charAt(0)}</div>
                                 <h4 className="text-lg font-bold">{emp.name}</h4>
                                 <p className="text-[10px] text-zinc-700 font-bold uppercase">{emp.employeeId}</p>
                              </div>
                           ))}
                        </div>
                     ) : renderCalendar(selectedUser)}
                  </div>
               )}

               {activeTab === 'leaves' && (
                  <div className="space-y-12 animate-fade-in">
                     <div className="space-y-8">
                        <h2 className="text-3xl font-black italic uppercase underline decoration-brand-red decoration-4">Pending Approvals</h2>
                        {/* Desktop View */}
                        <div className="hidden lg:block vfx-card !bg-brand-card/20 rounded-[40px] border-white/5 overflow-hidden shadow-2xl">
                           <table className="w-full text-left">
                              <thead>
                                 <tr className="bg-yellow-500/10 text-[10px] font-black uppercase text-yellow-500 tracking-widest"><th className="px-8 py-5">Node Identity</th><th className="px-8 py-5">Operational Range</th><th className="px-8 py-5">Rational Statement</th><th className="px-8 py-5">Command</th></tr>
                              </thead>
                              <tbody>
                                 {leaves.filter(l => l.status === 'pending').length === 0 ? (
                                    <tr><td colSpan={4} className="px-8 py-10 text-center text-zinc-800 font-black uppercase text-xs">No Pending Signals Tracked</td></tr>
                                 ) : (
                                    leaves.filter(l => l.status === 'pending').map((request, i) => (
                                       <tr key={i} className="border-t border-white/5 hover:bg-white/5 group">
                                          <td className="px-8 py-6">
                                             <div className="font-bold text-white">{request.employeeName}</div>
                                             <div className="text-[10px] text-zinc-600 font-black">{request.userId?.mwgId || request.employeeId}</div>
                                          </td>
                                          <td className="px-8 py-6 text-zinc-300 font-black text-xs">{request.startDate} <span className="text-zinc-800">→</span> {request.endDate}</td>
                                          <td className="px-8 py-6 text-zinc-500 text-xs italic leading-relaxed max-w-sm">"{request.reason}"</td>
                                          <td className="px-8 py-6 flex gap-3">
                                             <button disabled={isActionLoading} onClick={() => handleLeaveAction(request._id, 'approved')} className="p-4 bg-green-500/10 text-green-500 rounded-[20px] hover:bg-green-600 hover:text-white transition-all shadow-lg shadow-green-900/10 disabled:opacity-50">
                                                {isActionLoading ? <Loader className="w-5 h-5" /> : <Check size={18} />}
                                             </button>
                                             <button disabled={isActionLoading} onClick={() => handleLeaveAction(request._id, 'rejected')} className="p-4 bg-red-500/10 text-red-500 rounded-[20px] hover:bg-red-600 hover:text-white transition-all shadow-lg shadow-red-900/10 disabled:opacity-50">
                                                {isActionLoading ? <Loader className="w-5 h-5" /> : <X size={18} />}
                                             </button>
                                          </td>
                                       </tr>
                                    ))
                                 )}
                              </tbody>
                           </table>
                        </div>

                        {/* Mobile View */}
                        <div className="lg:hidden space-y-4">
                           {leaves.filter(l => l.status === 'pending').length === 0 ? (
                              <div className="vfx-card !p-10 text-center text-zinc-800 font-black uppercase text-xs">No Pending Signals Tracked</div>
                           ) : (
                              leaves.filter(l => l.status === 'pending').map((request, i) => (
                                 <div key={i} className="bg-brand-card/40 border border-brand-border p-6 rounded-[28px] space-y-6">
                                    <div className="flex justify-between items-start">
                                       <div>
                                          <div className="font-bold text-white text-lg">{request.employeeName}</div>
                                          <div className="text-[10px] text-zinc-600 font-black">{request.employeeId}</div>
                                       </div>
                                       <div className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase">Pending</div>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-2xl flex flex-col gap-1">
                                       <span className="text-[8px] font-black text-zinc-600 uppercase">Requested Period</span>
                                       <div className="text-sm font-bold text-zinc-300">{request.startDate} <span className="text-brand-red">to</span> {request.endDate}</div>
                                    </div>
                                    <div className="space-y-2">
                                       <span className="text-[8px] font-black text-zinc-600 uppercase">Reason</span>
                                       <p className="text-xs text-zinc-500 italic leading-relaxed">"{request.reason}"</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                       <button disabled={isActionLoading} onClick={() => handleLeaveAction(request._id, 'approved')} className="py-4 bg-green-500/10 text-green-500 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 border border-green-500/20 active:bg-green-600 active:text-white disabled:opacity-50">
                                          {isActionLoading ? <Loader className="w-4 h-4" /> : <Check size={16}/>} Approve
                                       </button>
                                       <button disabled={isActionLoading} onClick={() => handleLeaveAction(request._id, 'rejected')} className="py-4 bg-red-500/10 text-red-500 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 border border-red-500/20 active:bg-red-600 active:text-white disabled:opacity-50">
                                          {isActionLoading ? <Loader className="w-4 h-4" /> : <X size={16}/>} Reject
                                       </button>
                                    </div>
                                 </div>
                              ))
                           )}
                        </div>

                     </div>

                     <div className="space-y-8 pb-20">
                        <h3 className="text-xl font-bold uppercase text-zinc-700 italic border-l-4 border-white/10 pl-4">Operational History</h3>
                        <div className="vfx-card !bg-brand-card/10 rounded-[40px] border-white/5 overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
                           <table className="w-full text-left">
                              <thead>
                                 <tr className="bg-white/5 text-[9px] font-black uppercase text-zinc-700 tracking-[0.2em]"><th className="px-8 py-4">Node</th><th className="px-8 py-4">Status</th><th className="px-8 py-4">Resolution</th><th className="px-8 py-4">Timestamp</th></tr>
                              </thead>
                              <tbody>
                                 {leaves.filter(l => l.status !== 'pending').slice(0, 10).map((request, i) => (
                                    <tr key={i} className="border-t border-white/5">
                                       <td className="px-8 py-5">
                                          <div className="font-bold text-zinc-400 text-xs">{request.employeeName}</div>
                                       </td>
                                       <td className="px-8 py-5">
                                          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded inline-block ${request.status === 'approved' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{request.status}</span>
                                       </td>
                                       <td className="px-8 py-5 text-zinc-600 text-xs truncate max-w-[200px] italic">"{request.adminNote || 'No recorded note'}"</td>
                                       <td className="px-8 py-5 text-zinc-800 font-bold text-[10px]">{request.processedAt ? new Date(request.processedAt).toLocaleDateString() : 'N/A'}</td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'users' && (
                  <div className="space-y-8 animate-fade-in">
                     <div className="flex justify-between items-center">
                        <h2 className="text-3xl font-black italic uppercase italic underline decoration-brand-red decoration-4">Manage Users</h2>
                        <button onClick={() => setShowAddUserModal(true)} className="flex items-center gap-3 bg-brand-red text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-900/40 hover:bg-red-700 transition-all active:scale-95">
                           <UserPlus size={16} /> Create New User
                        </button>
                     </div>

                        {/* Desktop View */}
                        <div className="hidden lg:block vfx-card !bg-brand-card/20 rounded-[40px] border-white/5 overflow-hidden">
                           <table className="w-full text-left">
                              <thead>
                                 <tr className="bg-zinc-900/50 text-[10px] font-black uppercase text-zinc-700">
                                    <th className="px-8 py-5">Employee Info</th>
                                    <th className="px-8 py-5">Contact</th>
                                    <th className="px-8 py-5">Department</th>
                                    <th className="px-8 py-5">Actions</th>
                                 </tr>
                              </thead>
                              <tbody className="text-sm">
                                 {workforce.filter(w => w.name.toLowerCase().includes(search.toLowerCase()) || w.employeeId.includes(search)).map((user, i) => (
                                    <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                                       <td className="px-8 py-6">
                                          <div className="flex items-center gap-4">
                                             <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center font-bold text-zinc-600">{user.name.charAt(0)}</div>
                                             <div>
                                                <div className="font-bold text-white">{user.name}</div>
                                                <div className="text-[10px] font-black text-brand-red uppercase">{user.employeeId}</div>
                                             </div>
                                          </div>
                                       </td>
                                       <td className="px-8 py-6">
                                          <div className="flex flex-col gap-1">
                                             <div className="text-xs text-zinc-400 font-bold">{user.email}</div>
                                             <div className="text-[10px] text-zinc-600 font-bold uppercase">{user.phone || 'No Phone'}</div>
                                          </div>
                                       </td>
                                       <td className="px-8 py-6">
                                          <span className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-black text-zinc-400 uppercase tracking-widest">{user.department}</span>
                                       </td>
                                       <td className="px-8 py-6">
                                          <div className="flex gap-2">
                                             <button onClick={() => setIsEditingUser({ ...user, password: '' })} className="p-3 bg-white/5 rounded-xl hover:text-brand-red transition-all"><Pencil size={16} /></button>
                                             <button onClick={() => handleDeleteUser(user._id)} className="p-3 bg-white/5 rounded-xl hover:text-red-600 transition-all"><Trash2 size={16} /></button>
                                          </div>
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>

                        {/* Mobile View */}
                        <div className="lg:hidden space-y-4">
                           {workforce.filter(w => w.name.toLowerCase().includes(search.toLowerCase()) || w.employeeId.includes(search)).map((user, i) => (
                              <div key={i} className="bg-brand-card/30 border border-brand-border p-6 rounded-[28px] space-y-4">
                                 <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                       <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center font-black text-zinc-700">{user.name.charAt(0)}</div>
                                       <div>
                                          <div className="font-bold text-white text-sm">{user.name}</div>
                                          <div className="text-[9px] font-black text-brand-red uppercase">{user.employeeId}</div>
                                       </div>
                                    </div>
                                    <div className="flex gap-2">
                                       <button onClick={() => setIsEditingUser({ ...user, password: '' })} className="p-3 bg-white/5 rounded-xl text-zinc-500"><Pencil size={14} /></button>
                                       <button onClick={() => handleDeleteUser(user._id)} className="p-3 bg-white/5 rounded-xl text-zinc-500"><Trash2 size={14} /></button>
                                    </div>
                                 </div>
                                 <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 p-3 rounded-xl">
                                       <span className="text-[8px] font-black text-zinc-700 uppercase">Contact</span>
                                       <div className="text-[10px] font-bold text-zinc-400 truncate">{user.phone || 'No Phone'}</div>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-xl text-right">
                                       <span className="text-[8px] font-black text-zinc-700 uppercase">Department</span>
                                       <div className="text-[10px] font-black text-white uppercase">{user.department}</div>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>

                  </div>
               )}
            </main>
         </div>

         {/* Add User Modal */}
         {showAddUserModal && (
            <div className="fixed inset-0 bg-black/95 z-[1000] flex items-center justify-center p-6 backdrop-blur-2xl">
               <div className="bg-brand-card border border-white/10 w-full max-w-xl p-10 rounded-[40px] space-y-8 animate-fade-in">
                  <div className="flex justify-between items-center">
                     <h3 className="text-2xl font-black italic uppercase">Create New Workforce Node</h3>
                     <button onClick={() => setShowAddUserModal(false)}><X size={24} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Full Name</label>
                        <input type="text" placeholder="John Doe" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-red" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Phone Number</label>
                        <input type="text" placeholder="+91 ..." className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-red" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Email Address (Optional)</label>
                        <input type="email" placeholder="john@email.com" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-red" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Expected In</label>
                        <input type="time" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-red" value={newUser.expectedInTime} onChange={(e) => setNewUser({ ...newUser, expectedInTime: e.target.value })} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Expected Out</label>
                        <input type="time" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-red" value={newUser.expectedOutTime} onChange={(e) => setNewUser({ ...newUser, expectedOutTime: e.target.value })} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Password</label>
                        <input type="text" placeholder="Set password" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-red" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Department</label>
                        <select className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-red" value={newUser.department} onChange={(e) => setNewUser({ ...newUser, department: e.target.value, staffType: e.target.value })}>
                           <option value="Office Staff" className="bg-zinc-900 text-white">Office Staff</option>
                           <option value="Field Staff" className="bg-zinc-900 text-white">Field Staff</option>
                           <option value="Management" className="bg-zinc-900 text-white">Management</option>
                           <option value="Intern" className="bg-zinc-900 text-white">Intern</option>
                        </select>
                     </div>
                     <div className="flex items-center gap-4 pt-6">
                        <input type="checkbox" className="w-5 h-5 flex-shrink-0" checked={newUser.isAdmin} onChange={(e) => setNewUser({ ...newUser, isAdmin: e.target.checked })} id="isadmin" />
                        <label htmlFor="isadmin" className="text-sm font-bold text-zinc-500 cursor-pointer">Grant Admin Access</label>
                     </div>
                  </div>
                  <button disabled={isActionLoading} onClick={handleCreateUser} className="w-full py-5 bg-brand-red text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 shadow-xl shadow-red-900/30 flex items-center justify-center gap-3 active:scale-95 disabled:grayscale disabled:opacity-50">
                     {isActionLoading ? <Loader className="w-6 h-6" /> : 'Provision User & Sync ID'}
                  </button>
               </div>
            </div>
         )}

         {isEditingUser && (
            <div className="fixed inset-0 bg-black/95 z-[1000] flex items-center justify-center p-6 backdrop-blur-2xl">
               <div className="bg-brand-card border border-white/10 w-full max-w-xl p-10 rounded-[40px] space-y-8">
                  <div className="flex justify-between items-center">
                     <h3 className="text-2xl font-black italic uppercase">Edit Node: {isEditingUser.employeeId}</h3>
                     <button onClick={() => setIsEditingUser(null)}><X size={24} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 italic">Full Name</label>
                        <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none" value={isEditingUser.name} onChange={(e) => setIsEditingUser({ ...isEditingUser, name: e.target.value })} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 italic">Phone</label>
                        <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none" value={isEditingUser.phone} onChange={(e) => setIsEditingUser({ ...isEditingUser, phone: e.target.value })} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 italic">Expected In</label>
                        <input type="time" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none" value={isEditingUser.expectedInTime || '09:30'} onChange={(e) => setIsEditingUser({ ...isEditingUser, expectedInTime: e.target.value })} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 italic">Expected Out</label>
                        <input type="time" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none" value={isEditingUser.expectedOutTime || '18:30'} onChange={(e) => setIsEditingUser({ ...isEditingUser, expectedOutTime: e.target.value })} />
                     </div>
                     <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 italic">Reset Password (Keep blank to skip)</label>
                        <input type="text" placeholder="New password..." className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none" value={isEditingUser.password || ''} onChange={(e) => setIsEditingUser({ ...isEditingUser, password: e.target.value })} />
                     </div>
                     <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 italic">Department</label>
                        <select className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-red" value={isEditingUser.department} onChange={(e) => setIsEditingUser({ ...isEditingUser, department: e.target.value })}>
                           <option value="Office Staff" className="bg-zinc-900 text-white">Office Staff</option>
                           <option value="Field Staff" className="bg-zinc-900 text-white">Field Staff</option>
                           <option value="Management" className="bg-zinc-900 text-white">Management</option>
                           <option value="Intern" className="bg-zinc-900 text-white">Intern</option>
                        </select>
                     </div>
                  </div>
                  <button disabled={isActionLoading} onClick={handleUpdateUser} className="w-full py-5 bg-brand-red text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 disabled:grayscale disabled:opacity-50">
                     {isActionLoading ? <Loader className="w-6 h-6" /> : <Save size={18} />} 
                     {isActionLoading ? 'Updating Node...' : 'Update Workforce Node'}
                  </button>
               </div>
            </div>
         )}
         {/* Detailed Log Modal */}
         {selectedGroupLog && (
            <div className="fixed inset-0 bg-black/95 z-[2000] flex items-center justify-center p-6 backdrop-blur-3xl animate-fade-in" onClick={() => setSelectedGroupLog(null)}>
               <div className="bg-brand-card border border-white/10 w-full max-w-4xl rounded-[48px] overflow-hidden shadow-3xl flex flex-col lg:flex-row relative" onClick={e => e.stopPropagation()}>
                  <button
                     onClick={() => setSelectedGroupLog(null)}
                     className="absolute top-6 right-6 z-50 w-12 h-12 bg-white/5 hover:bg-brand-red text-white rounded-2xl flex items-center justify-center transition-all"
                  >
                     <X size={24} />
                  </button>

                  <div className="w-full lg:w-1/2 aspect-square lg:aspect-auto bg-zinc-900 flex items-center justify-center group relative border-r border-white/5">
                    {selectedGroupLog.latestSelfie ? (
                        <>
                           <Image src={selectedGroupLog.latestSelfie} alt="Selfie" className="w-full h-full object-cover" width={800} height={800} unoptimized />
                           <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                           <div className="absolute bottom-8 left-8 right-8">
                              <p className="text-[10px] font-black text-brand-red uppercase tracking-widest mb-1">Active Proof of Work</p>
                              <h3 className="text-3xl font-black italic uppercase italic text-white underline decoration-brand-red decoration-2 underline-offset-4">{selectedGroupLog.userName}</h3>
                           </div>
                        </>
                     ) : (
                        <div className="flex flex-col items-center gap-4 text-zinc-800">
                           <ShieldAlert size={64} />
                           <p className="font-bold text-xs uppercase tracking-widest">No Visual Evidence</p>
                        </div>
                     )}
                  </div>

                  <div className="p-10 lg:p-14 flex-grow flex flex-col justify-between space-y-10">
                     <div className="space-y-8">
                        <div className="flex justify-between items-start">
                           <div>
                              <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-2">Shift Metrics</p>
                              <div className="text-5xl font-black italic uppercase text-white leading-none">{calculateHours(selectedGroupLog.punchIn, selectedGroupLog.punchOut)}</div>
                              <p className="text-xs font-bold text-zinc-500 mt-2">Active Working Duration Today</p>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                           <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                              <p className="text-[9px] font-black text-green-500 uppercase tracking-widest mb-2">Punch In</p>
                              <div className="text-2xl font-black text-white">{selectedGroupLog.punchIn || '--:--'}</div>
                           </div>
                           <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                              <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-2">Punch Out</p>
                              <div className="text-2xl font-black text-white">{selectedGroupLog.punchOut || '--:--'}</div>
                           </div>
                        </div>

                        <div className="space-y-3">
                           <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest pl-1">Latest Tracking Node</p>
                           <div className="bg-white/5 rounded-3xl p-6 border border-white/5 flex items-start gap-4">
                              <div className="w-10 h-10 bg-brand-red/10 rounded-xl flex items-center justify-center shrink-0">
                                 <MapPin size={20} className="text-brand-red" />
                              </div>
                              <div>
                                 <p className="text-white font-bold text-sm leading-relaxed">{selectedGroupLog.latestLocation}</p>
                                 {selectedGroupLog.lat && (
                                    <a
                                       href={`https://maps.google.com/?q=${selectedGroupLog.lat},${selectedGroupLog.lon}`}
                                       target="_blank"
                                       className="inline-flex items-center gap-2 mt-4 text-[10px] font-black bg-white text-black px-6 py-3 rounded-xl hover:bg-brand-red hover:text-white transition-all uppercase tracking-widest"
                                    >
                                       Open Command Map
                                    </a>
                                 )}
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest text-center italic">ID: {selectedGroupLog.employeeId} • Session Crypt-Verified</p>
                     </div>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}
