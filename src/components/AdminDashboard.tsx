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
import { adminFetch } from '@/lib/adminFetch';

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
   remark?: string;
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
   const [activePhotoTab, setActivePhotoTab] = useState<'in' | 'out'>('in');
   const [selectedDayDetails, setSelectedDayDetails] = useState<any>(null);
   const [logPage, setLogPage] = useState(1);
   // Logs tab filters
   const [logFilterDate, setLogFilterDate] = useState('');
   const [logFilterEmployee, setLogFilterEmployee] = useState('');
   const [logFilterStatus, setLogFilterStatus] = useState('');
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
            new Notification("New Leave Request", {
               body: `${newest.employeeName} has requested leave starting ${newest.startDate}`,
               icon: '/logo.png',
               tag: 'leave-req'
            });
         }
      }
      prevPendingCount.current = currentCount;
   }, [leaves, notificationPermission]);

   const fetchData = async () => {
      setIsLoading(true);
      try {
         const [lRes, wRes, lvRes] = await Promise.all([
            adminFetch('/api/attendance'), // Admin fetch — returns all records
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
      const adminNote = prompt(`Enter reason for ${action === 'approved' ? 'approval' : 'rejection'}:`) || '';
      setIsActionLoading(true);
      try {
         const res = await adminFetch('/api/leaves', {
            method: 'PUT',
            body: JSON.stringify({ id, status: action, adminNote })
         });
         if (res.ok) fetchData();
      } catch (err) { console.error('Error updating leave:', err); }
      finally { setIsActionLoading(false); }
   };

   const handleCreateUser = async () => {
      if (!newUser.name || !newUser.password) return alert("Please fill in the required fields (Name and Password).");
      setIsActionLoading(true);
      try {
         const res = await adminFetch('/api/users', {
            method: 'POST',
            body: JSON.stringify(newUser)
         });
         if (res.ok) {
            alert("Employee added successfully!");
            setShowAddUserModal(false);
            setNewUser({ name: '', phone: '', email: '', password: '', department: 'Field Staff', staffType: 'Field Staff', isAdmin: false, expectedInTime: '09:30', expectedOutTime: '18:30' });
            fetchData();
         } else {
            const err = await res.json();
            alert(err.error || "Could not create user. Please try again.");
         }
      } catch (err) { console.error(err); }
      finally { setIsActionLoading(false); }
   };

   const handleUpdateUser = async () => {
      if (!isEditingUser) return;
      setIsActionLoading(true);
      try {
         const res = await adminFetch('/api/users', {
            method: 'PUT',
            body: JSON.stringify({ id: isEditingUser._id, ...isEditingUser })
         });
         if (res.ok) {
            alert("Employee updated successfully!");
            setIsEditingUser(null);
            fetchData();
         }
      } catch (err) { console.error(err); }
      finally { setIsActionLoading(false); }
   };

   const handleDeleteUser = async (id: string) => {
      if (!confirm("Are you sure you want to remove this employee?")) return;
      setIsActionLoading(true);
      try {
         const res = await adminFetch(`/api/users?id=${id}`, { method: 'DELETE' });
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
         // Grab selfie and note from logs
         const daySelfie = dayLogs.find(l => l.selfie)?.selfie || null;
         const dayRemark = dayLogs.find(l => l.remark && l.remark.includes('You forgot to log out'))?.remark || dayLogs.find(l => l.remark)?.remark || '';
         const dayLat = dayLogs.find(l => l.lat)?.lat;
         const dayLon = dayLogs.find(l => l.lon)?.lon;
         const dayLocation = dayLogs.find(l => l.location)?.location || '';

         calendarGrid.push(
            <div
               key={d}
               onClick={() => (isPresent || isLeave || isPendingLeave) && setSelectedDayDetails({ date: dStr, punchIn, punchOut, status, selfie: daySelfie, remark: dayRemark, lat: dayLat, lon: dayLon, location: dayLocation, userName: user.name })}
               className={`aspect-square border border-white/5 flex flex-col items-center justify-center relative rounded-xl transition-all group ${
                  (isPresent || isLeave || isPendingLeave) ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
               } ${isPendingLeave ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse' :
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
               {(isPresent || isLeave) && <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 rounded-xl transition-all" />}
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

            {/* Calendar Day Detail Popup — with selfie */}
            {selectedDayDetails && (
               <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => setSelectedDayDetails(null)}>
                  <div
                     className="bg-brand-card border border-white/10 w-full sm:max-w-md rounded-t-[40px] sm:rounded-[40px] overflow-hidden shadow-2xl animate-fade-in flex flex-col"
                     onClick={e => e.stopPropagation()}
                  >
                     {/* Selfie header */}
                     <div className="relative bg-zinc-900 aspect-video sm:aspect-[4/3] flex items-center justify-center overflow-hidden">
                        {selectedDayDetails.selfie ? (
                           <>
                              <Image src={selectedDayDetails.selfie} alt="Selfie" fill className="object-cover" unoptimized />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                              <div className="absolute bottom-4 left-5 right-5">
                                 <p className="text-[9px] font-black text-brand-red uppercase tracking-widest mb-0.5">Check-in Photo</p>
                                 <h3 className="text-xl font-black text-white uppercase italic">{selectedDayDetails.userName}</h3>
                              </div>
                           </>
                        ) : (
                           <div className="flex flex-col items-center gap-3 text-zinc-700 py-10">
                              <ShieldAlert size={48} />
                              <p className="text-xs font-black uppercase tracking-widest">No selfie for this day</p>
                           </div>
                        )}
                        <button
                           onClick={() => setSelectedDayDetails(null)}
                           className="absolute top-4 right-4 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/10 text-white hover:bg-brand-red transition-all"
                        >
                           <X size={18} />
                        </button>
                     </div>

                     {/* Details */}
                     <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                           <div className="bg-white/5 rounded-2xl p-4">
                              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Date</p>
                              <p className="text-sm font-bold text-white">{new Date(selectedDayDetails.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                           </div>
                           <div className="bg-white/5 rounded-2xl p-4">
                              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Status</p>
                              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
                                 selectedDayDetails.status === 'Late' ? 'bg-orange-500/20 text-orange-400' :
                                 selectedDayDetails.status === 'On-Time' ? 'bg-green-500/20 text-green-400' :
                                 selectedDayDetails.status === 'Leave' ? 'bg-red-500/20 text-red-400' :
                                 'bg-zinc-800 text-zinc-500'
                              }`}>{selectedDayDetails.status}</span>
                           </div>
                           <div className="bg-green-500/10 border border-green-500/10 rounded-2xl p-4">
                              <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">Punch In</p>
                              <p className={`text-lg font-black ${selectedDayDetails.status === 'Late' ? 'text-orange-400' : 'text-green-400'}`}>{selectedDayDetails.punchIn}</p>
                           </div>
                           <div className="bg-red-500/10 border border-red-500/10 rounded-2xl p-4">
                              <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-1">Punch Out</p>
                              <p className={`text-lg font-black ${selectedDayDetails.punchOut !== '--:--' ? 'text-white' : 'text-zinc-700'}`}>{selectedDayDetails.punchOut}</p>
                           </div>
                        </div>

                        {/* Hours worked */}
                        {selectedDayDetails.punchIn !== '--:--' && selectedDayDetails.punchOut !== '--:--' && (
                           <div className="bg-white/5 rounded-2xl p-4 flex justify-between items-center">
                              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Hours Worked</p>
                              <p className="text-xl font-black text-white">{calculateHours(selectedDayDetails.punchIn, selectedDayDetails.punchOut)}</p>
                           </div>
                        )}

                        {/* Location */}
                        {selectedDayDetails.location && (
                           <div className="bg-white/5 rounded-2xl p-4 flex items-start gap-3">
                              <MapPin size={16} className="text-brand-red shrink-0 mt-0.5" />
                              <div>
                                 <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Location</p>
                                 <p className="text-xs text-zinc-300 font-bold leading-relaxed">{selectedDayDetails.location}</p>
                                 {selectedDayDetails.lat && (
                                    <a href={`https://maps.google.com/?q=${selectedDayDetails.lat},${selectedDayDetails.lon}`} target="_blank"
                                       className="inline-flex items-center gap-1.5 mt-2 text-[9px] font-black text-brand-red uppercase tracking-widest hover:underline">
                                       <ExternalLink size={11} /> Open on Google Maps
                                    </a>
                                 )}
                              </div>
                           </div>
                        )}

                        {/* Auto-logout System Note */}
                        {selectedDayDetails.remark && (
                           <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 mt-2">
                              <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-2 mb-1">
                                 <Activity size={10} /> System Note
                              </p>
                              <p className="text-xs text-orange-400 font-bold leading-relaxed">{selectedDayDetails.remark}</p>
                           </div>
                        )}

                        <button onClick={() => setSelectedDayDetails(null)} className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-red-900/30">Close</button>
                     </div>
                  </div>
               </div>
            )}
         </div>
      );
   };

   const BackgroundDecorations = () => (
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
         <div className="absolute top-[-20%] left-[-20%] w-[100vw] h-[100vw] bg-brand-red/15 rounded-full blur-[150px] animate-float-red" style={{ animationDelay: '0s' }}></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[80vw] h-[80vw] bg-brand-red/10 rounded-full blur-[120px] animate-float-red" style={{ animationDelay: '-5s' }}></div>
         <div className="absolute top-[20%] right-[0%] w-[60vw] h-[60vw] bg-brand-red/10 rounded-full blur-[100px] animate-float-red" style={{ animationDelay: '-12s' }}></div>

         <div className="absolute top-[15%] left-[25%] w-2 h-2 bg-brand-red rounded-full shadow-[0_0_20px_#e61e2a] animate-pulse-dot" style={{ animationDelay: '0s' }}></div>
         <div className="absolute top-[55%] left-[12%] w-2 h-2 bg-brand-red rounded-full shadow-[0_0_20px_#e61e2a] animate-pulse-dot" style={{ animationDelay: '1.2s' }}></div>
         <div className="absolute bottom-[25%] right-[35%] w-2 h-2 bg-brand-red rounded-full shadow-[0_0_20px_#e61e2a] animate-pulse-dot" style={{ animationDelay: '2.5s' }}></div>
         <div className="absolute top-[12%] right-[18%] w-2 h-2 bg-brand-red/80 rounded-full shadow-[0_0_15px_#e61e2a] animate-pulse-dot" style={{ animationDelay: '3.8s' }}></div>
         <div className="absolute bottom-[15%] left-[45%] w-2 h-2 bg-brand-red/60 rounded-full shadow-[0_0_15px_#e61e2a] animate-pulse-dot" style={{ animationDelay: '0.8s' }}></div>
      </div>
   );

   return (
      <div className="min-h-screen bg-black text-white flex relative overflow-hidden font-sans selection:bg-brand-red">
         <BackgroundDecorations />
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

         <div className="flex-grow flex flex-col relative z-base overflow-hidden">
            {/* Admin Mobile Header */}
            <header className="lg:hidden sticky top-0 z-[100] flex items-center justify-between px-6 py-4 bg-black/80 backdrop-blur-xl border-b border-white/5">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center p-1 shadow-lg shadow-red-900/40">
                     <Image src="/logo.png" alt="MWG" width={24} height={24} />
                  </div>
                  <span className="font-black text-[10px] uppercase tracking-widest text-white">Admin Command</span>
               </div>
               <button onClick={() => { localStorage.removeItem('user'); window.location.reload(); }} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-500 hover:text-white transition-all">
                  <LogOut size={16} />
               </button>
            </header>

            {/* Admin Mobile Nav (Bottom Bar) */}
            <nav className="lg:hidden fixed bottom-6 left-6 right-6 h-18 bg-brand-card/90 backdrop-blur-2xl border border-white/10 rounded-2xl flex justify-around items-center px-4 z-[100] shadow-2xl pb-safe">
               {[
                  { id: 'dashboard', icon: Activity, label: 'Logs' },
                  { id: 'employees', icon: Users, label: 'Staff' },
                  { id: 'leaves', icon: FileText, label: 'Leaves' },
                  { id: 'users', icon: ShieldAlert, label: 'Users' }
               ].map(item => (
                  <button key={item.id} onClick={() => { setActiveTab(item.id as any); setSelectedUser(null); }} className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-300 ${activeTab === item.id ? 'text-brand-red scale-110' : 'text-zinc-600'}`}>
                     <item.icon size={22} className={activeTab === item.id ? 'drop-shadow-[0_0_8px_rgba(230,30,42,0.4)]' : ''} />
                     <span className="text-[8px] font-black uppercase tracking-tighter">{item.label}</span>
                  </button>
               ))}
            </nav>

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
               {activeTab === 'dashboard' && (() => {
                  const groupedLogsMap = new Map();
                  [...logs].reverse().forEach((l: any) => {
                      const key = `${l.employeeId}-${l.date}`;
                      if (!groupedLogsMap.has(key)) {
                          groupedLogsMap.set(key, { ...l, punchIn: null, punchOut: null, punchOutSelfie: null });
                      }
                      const existing = groupedLogsMap.get(key);
                      if (l.status === 'Checked Out') {
                          existing.punchOut = l.time;
                          existing.remark = l.remark || existing.remark;
                          existing.punchOutSelfie = l.selfie || null;
                          if(!existing.punchIn) existing.status = 'Checked Out';
                      } else {
                          existing.punchIn = l.time;
                          existing.status = l.status; // 'Checked In' or 'Late'
                          existing.selfie = l.selfie || existing.selfie;
                          existing.location = l.location || existing.location;
                      }
                  });
                  const combinedLogs = Array.from(groupedLogsMap.values());

                  // Filtered full history logs
                  const filteredHistoryLogs = combinedLogs.filter(l => {
                     const nameMatch = !logFilterEmployee ||
                        (l.userName && l.userName.toLowerCase().includes(logFilterEmployee.toLowerCase())) ||
                        l.employeeId.toLowerCase().includes(logFilterEmployee.toLowerCase());
                     const dateMatch = !logFilterDate || l.date === logFilterDate;
                     const statusMatch = !logFilterStatus || l.status === logFilterStatus;
                     return nameMatch && dateMatch && statusMatch;
                  }).sort((a, b) => {
                     if (a.date !== b.date) return a.date > b.date ? -1 : 1;
                     const tA = new Date(`1970/01/01 ${a.punchIn || a.punchOut || '00:00:00'}`).getTime();
                     const tB = new Date(`1970/01/01 ${b.punchIn || b.punchOut || '00:00:00'}`).getTime();
                     return tB - tA;
                  });
                  const historyPage = logPage;
                  const totalPages = Math.ceil(filteredHistoryLogs.length / logsPerPage);
                  const pagedLogs = filteredHistoryLogs.slice((historyPage - 1) * logsPerPage, historyPage * logsPerPage);

                  return (
                  <div className="space-y-6 animate-fade-in">
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-2xl lg:text-3xl font-black italic uppercase underline decoration-brand-red decoration-4">Attendance History</h2>
                        <button onClick={fetchData} className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all self-start sm:self-auto">
                           <RefreshCcw size={14} /> Refresh
                        </button>
                     </div>

                     {/* Filter Bar */}
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white/5 border border-white/10 rounded-xl flex items-center gap-3 px-4">
                           <Search size={14} className="text-zinc-600 shrink-0" />
                           <input
                              type="text"
                              placeholder="Search employee..."
                              className="bg-transparent outline-none text-sm py-3 text-white placeholder:text-zinc-700 w-full"
                              value={logFilterEmployee}
                              onChange={e => { setLogFilterEmployee(e.target.value); setLogPage(1); }}
                           />
                           {logFilterEmployee && <button onClick={() => setLogFilterEmployee('')} className="text-zinc-600 hover:text-white"><X size={14} /></button>}
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl flex items-center gap-3 px-4">
                           <CalendarIcon size={14} className="text-zinc-600 shrink-0" />
                           <input
                              type="date"
                              className="bg-transparent outline-none text-sm py-3 text-white placeholder:text-zinc-700 w-full [color-scheme:dark]"
                              value={logFilterDate}
                              onChange={e => { setLogFilterDate(e.target.value); setLogPage(1); }}
                           />
                           {logFilterDate && <button onClick={() => setLogFilterDate('')} className="text-zinc-600 hover:text-white"><X size={14} /></button>}
                        </div>
                        <select
                           className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none [color-scheme:dark]"
                           value={logFilterStatus}
                           onChange={e => { setLogFilterStatus(e.target.value); setLogPage(1); }}
                        >
                           <option value="">All Statuses</option>
                           <option value="Checked In">Checked In</option>
                           <option value="Checked Out">Checked Out</option>
                           <option value="Late">Late</option>
                           <option value="Leave">Leave</option>
                        </select>
                     </div>

                     {/* Results count */}
                     <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">
                        {isLoading ? 'Loading...' : `${filteredHistoryLogs.length} record${filteredHistoryLogs.length !== 1 ? 's' : ''} found`}
                     </p>

                     {/* Desktop Table */}
                     <div className="hidden lg:block bg-brand-card/20 border border-white/5 rounded-[40px] overflow-hidden">
                        <table className="w-full text-left">
                           <thead>
                              <tr className="bg-white/5 border-b border-white/5 text-[10px] font-black text-zinc-700 uppercase">
                                 <th className="px-6 py-4">Employee</th>
                                 <th className="px-6 py-4">Photo</th>
                                 <th className="px-6 py-4">Date</th>
                                 <th className="px-6 py-4">Status</th>
                                 <th className="px-6 py-4">Shift Time</th>
                                 <th className="px-6 py-4">Location</th>
                              </tr>
                           </thead>
                           <tbody className="text-sm">
                              {isLoading ? (
                                 <tr><td colSpan={6} className="px-8 py-20 text-center"><Loader className="mx-auto" /><p className="text-zinc-700 font-black uppercase text-[10px] tracking-widest mt-4">Loading...</p></td></tr>
                              ) : pagedLogs.length === 0 ? (
                                 <tr><td colSpan={6} className="px-8 py-16 text-center text-zinc-800 font-black uppercase text-xs tracking-widest">No records match your filters</td></tr>
                              ) : pagedLogs.map((log, i) => {
                                 const empName = (log.userName && log.userName !== 'Unknown User') ? log.userName :
                                    (workforce.find(w => w.employeeId === log.employeeId)?.name || 'Unknown');
                                 return (
                                 <tr key={i} onClick={() => { setSelectedGroupLog({ ...log, userName: empName, punchIn: log.punchIn, punchOut: log.punchOut, latestSelfie: log.selfie, punchOutSelfie: log.punchOutSelfie, latestLocation: log.location }); setActivePhotoTab('in'); }} className="border-b border-white/5 hover:bg-white/5 cursor-pointer group transition-colors">
                                    <td className="px-6 py-4">
                                       <div className="font-bold text-white group-hover:text-brand-red transition-colors text-sm">{empName}</div>
                                       <div className="text-[10px] text-zinc-600 font-bold uppercase">{log.employeeId}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="w-11 h-11 bg-zinc-900 rounded-xl overflow-hidden border border-white/5 transition-transform group-hover:scale-110">
                                          {log.selfie ? (
                                             <Image src={log.selfie} alt="Selfie" className="w-full h-full object-cover" width={44} height={44} unoptimized />
                                          ) : (
                                             <div className="w-full h-full flex items-center justify-center text-zinc-800"><Activity size={16} /></div>
                                          )}
                                       </div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="text-white font-bold text-xs">{new Date(log.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                       <div className="text-zinc-700 text-[10px] font-bold uppercase">{new Date(log.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <span className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg ${
                                          log.status === 'Late' ? 'bg-orange-500/15 text-orange-400' :
                                          log.status === 'Checked In' ? 'bg-green-500/15 text-green-400' :
                                          log.status === 'Checked Out' ? 'bg-blue-500/15 text-blue-400' :
                                          log.status === 'Leave' ? 'bg-red-500/15 text-red-400' :
                                          'bg-zinc-800 text-zinc-500'
                                       }`}>{log.status}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="flex flex-col gap-1">
                                          <div className={`text-sm font-black ${log.punchIn && log.status === 'Late' ? 'text-orange-400' : 'text-green-400'}`}>IN: {log.punchIn || '--:--'}</div>
                                          <div className="text-sm font-black text-blue-400">OUT: {log.punchOut || '--:--'}</div>
                                       </div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="text-zinc-500 font-bold text-[10px] truncate max-w-[160px] flex items-center gap-1.5">
                                          <MapPin size={10} className="text-brand-red shrink-0" />{log.location}
                                       </div>
                                    </td>
                                 </tr>
                                 );
                              })}
                           </tbody>
                        </table>
                     </div>

                     {/* Mobile Cards — with selfie */}
                     <div className="lg:hidden space-y-3">
                        {isLoading ? (
                           <div className="py-20 text-center"><Loader className="mx-auto" /><p className="text-zinc-700 font-black uppercase text-[10px] tracking-widest mt-4">Loading...</p></div>
                        ) : pagedLogs.length === 0 ? (
                           <div className="py-16 text-center text-zinc-800 font-black uppercase text-xs tracking-widest">No records match your filters</div>
                        ) : pagedLogs.map((log, i) => {
                           const empName = (log.userName && log.userName !== 'Unknown User') ? log.userName :
                              (workforce.find(w => w.employeeId === log.employeeId)?.name || 'Unknown');
                           return (
                           <div key={i}
                              onClick={() => { setSelectedGroupLog({ ...log, userName: empName, punchIn: log.punchIn, punchOut: log.punchOut, latestSelfie: log.selfie, punchOutSelfie: log.punchOutSelfie, latestLocation: log.location }); setActivePhotoTab('in'); }}
                              className="bg-brand-card/40 border border-brand-border rounded-[24px] overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
                           >
                              {/* Selfie strip at top */}
                              {log.selfie && (
                                 <div className="relative h-36 bg-zinc-900 overflow-hidden">
                                    <Image src={log.selfie} alt="Selfie" fill className="object-cover object-top" unoptimized />
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90" />
                                    <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 flex items-center justify-between">
                                       <span className="text-white font-bold text-xs">{empName}</span>
                                       <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                                          log.status === 'Late' ? 'bg-orange-500/80 text-white' :
                                          log.status === 'Checked In' ? 'bg-green-600/80 text-white' :
                                          log.status === 'Checked Out' ? 'bg-blue-600/80 text-white' :
                                          'bg-red-600/80 text-white'
                                       }`}>{log.status}</span>
                                    </div>
                                 </div>
                              )}
                              <div className="p-4 space-y-3">
                                 {!log.selfie && (
                                    <div className="flex items-center justify-between">
                                       <div>
                                          <div className="font-bold text-white text-sm">{empName}</div>
                                          <div className="text-[9px] text-zinc-600 font-bold uppercase">{log.employeeId}</div>
                                       </div>
                                       <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg ${
                                          log.status === 'Late' ? 'bg-orange-500/15 text-orange-400' :
                                          log.status === 'Checked In' ? 'bg-green-500/15 text-green-400' :
                                          log.status === 'Checked Out' ? 'bg-blue-500/15 text-blue-400' :
                                          'bg-red-500/15 text-red-400'
                                       }`}>{log.status}</span>
                                    </div>
                                 )}
                                 <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                                    <div>
                                       <p className="text-[8px] font-black text-zinc-700 uppercase">Date</p>
                                       <p className="text-xs font-bold text-white">{new Date(log.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                                    </div>
                                    <div className="w-px h-6 bg-white/10" />
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col text-right">
                                           <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest leading-none">IN</span>
                                           <span className={`text-xs font-black ${log.punchIn && log.status === 'Late' ? 'text-orange-400' : 'text-green-400'}`}>{log.punchIn || '--:--'}</span>
                                        </div>
                                        <div className="text-zinc-800 font-black">/</div>
                                        <div className="flex flex-col">
                                           <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest leading-none">OUT</span>
                                           <span className="text-xs font-black text-blue-400">{log.punchOut || '--:--'}</span>
                                        </div>
                                     </div>
                                    <div className="w-px h-6 bg-white/10" />
                                    <div className="text-right">
                                       <p className="text-[8px] font-black text-zinc-700 uppercase">{log.employeeId}</p>
                                       <p className="text-[10px] font-bold text-zinc-500">{workforce.find(w => w.employeeId === log.employeeId)?.department || ''}</p>
                                    </div>
                                 </div>
                                 {log.location && (
                                    <div className="flex items-center gap-2 px-1">
                                       <MapPin size={11} className="text-brand-red shrink-0" />
                                       <span className="text-[10px] text-zinc-500 font-bold truncate">{log.location}</span>
                                    </div>
                                 )}
                              </div>
                           </div>
                           );
                        })}
                     </div>

                     {/* Pagination */}
                     {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 pt-2 pb-6">
                           <button onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={historyPage === 1} className="px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-black uppercase disabled:opacity-30 hover:bg-white/10 transition-all"><ChevronLeft size={16} /></button>
                           <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Page {historyPage} of {totalPages}</span>
                           <button onClick={() => setLogPage(p => Math.min(totalPages, p + 1))} disabled={historyPage === totalPages} className="px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-black uppercase disabled:opacity-30 hover:bg-white/10 transition-all"><ChevronRight size={16} /></button>
                        </div>
                     )}
                  </div>
                  );
               })()}

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
                                 <tr className="bg-yellow-500/10 text-[10px] font-black uppercase text-yellow-500 tracking-widest"><th className="px-8 py-5">Employee</th><th className="px-8 py-5">Leave Dates</th><th className="px-8 py-5">Reason</th><th className="px-8 py-5">Action</th></tr>
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
                        <h3 className="text-xl font-bold uppercase text-zinc-700 italic border-l-4 border-white/10 pl-4">Past Leave Requests</h3>
                        <div className="vfx-card !bg-brand-card/10 rounded-[40px] border-white/5 overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
                           <table className="w-full text-left">
                              <thead>
                                 <tr className="bg-white/5 text-[9px] font-black uppercase text-zinc-700 tracking-[0.2em]"><th className="px-8 py-4">Employee</th><th className="px-8 py-4">Status</th><th className="px-8 py-4">Admin Note</th><th className="px-8 py-4">Date Resolved</th></tr>
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
                     <h3 className="text-2xl font-black italic uppercase">Add New Employee</h3>
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
                     {isActionLoading ? <Loader className="w-6 h-6" /> : 'Create User'}
                  </button>
               </div>
            </div>
         )}

         {isEditingUser && (
            <div className="fixed inset-0 bg-black/95 z-[1000] flex items-center justify-center p-6 backdrop-blur-2xl">
               <div className="bg-brand-card border border-white/10 w-full max-w-xl p-10 rounded-[40px] space-y-8">
                  <div className="flex justify-between items-center">
                     <h3 className="text-2xl font-black italic uppercase">Edit Employee: {isEditingUser.employeeId}</h3>
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
                     {isActionLoading ? 'Saving...' : 'Save Changes'}
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

                  <div 
                     className={`w-full lg:w-1/2 aspect-square lg:aspect-auto bg-zinc-900 flex flex-col relative border-r border-white/5 ${selectedGroupLog.punchOutSelfie ? 'cursor-pointer group/photo' : ''}`}
                     onClick={() => { if(selectedGroupLog.punchOutSelfie) setActivePhotoTab(p => p === 'in' ? 'out' : 'in'); }}
                  >
                     {activePhotoTab === 'in' ? (
                        selectedGroupLog.latestSelfie ? (
                           <div className="relative flex-1 transition-all animate-fade-in">
                              <Image src={selectedGroupLog.latestSelfie} alt="Punch In Selfie" className="w-full h-full object-cover" width={800} height={800} unoptimized />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                              <div className="absolute bottom-6 sm:bottom-10 left-6 sm:left-10 right-6 sm:right-10">
                                 <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                                    Check-in Photo
                                    {selectedGroupLog.punchOutSelfie && <span className="bg-white/10 text-white px-2 py-1 rounded-md text-[8px] group-hover/photo:bg-white/20 transition-all">Click to see Check-Out</span>}
                                 </p>
                                 <h3 className="text-3xl font-black italic uppercase text-white truncate">{selectedGroupLog.userName}</h3>
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
                           <Image src={selectedGroupLog.punchOutSelfie} alt="Punch Out Selfie" className="w-full h-full object-cover" width={800} height={800} unoptimized />
                           <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                           <div className="absolute bottom-6 sm:bottom-10 left-6 sm:left-10 right-6 sm:right-10">
                              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                                 Check-out Photo
                                 {selectedGroupLog.latestSelfie && <span className="bg-white/10 text-white px-2 py-1 rounded-md text-[8px] group-hover/photo:bg-white/20 transition-all">Click to see Check-In</span>}
                              </p>
                              <h3 className="text-3xl font-black italic uppercase text-white truncate">{selectedGroupLog.userName}</h3>
                           </div>
                        </div>
                     )}
                  </div>

                  <div className="p-10 lg:p-14 flex-grow flex flex-col justify-between space-y-10">
                     <div className="space-y-8">
                        <div className="flex justify-between items-start">
                           <div>
                              <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-2">Hours Worked Today</p>
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
                           <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest pl-1">Location</p>
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
                                       Open on Google Maps
                                    </a>
                                 )}
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest text-center italic">Employee ID: {selectedGroupLog.employeeId}</p>
                     </div>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}
