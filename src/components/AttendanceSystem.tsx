"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { 
  MapPin, 
  Calendar, 
  BarChart3, 
  FileText, 
  Clock, 
  TrendingUp, 
  Search, 
  X, 
  CheckCircle2, 
  MoreHorizontal,
  LogOut,
  Camera,
  Mail,
  Smartphone,
  Check,
  MessageSquare
} from 'lucide-react';

interface AttendanceRecord {
  employeeId: string;
  date: string;
  time: string;
  status: 'Checked In' | 'Checked Out';
  location: string;
  lat?: number;
  lon?: number;
  remark: string;
  selfie: string | null;
}

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

export default function AttendanceSystem({ profile }: { profile: { _id?: string; name: string; employeeId: string; department: string; staffType: 'Office Staff' | 'Field Staff', createdAt?: string, expectedInTime?: string } }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [view, setView] = useState<'dashboard' | 'attendance' | 'reports' | 'leave'>('dashboard');
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([]);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [userLeaves, setUserLeaves] = useState<any[]>([]);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveDates, setLeaveDates] = useState({ start: '', end: '' });

  const today = new Date();
  const currentMonthIdx = today.getMonth();
  const currentYear = today.getFullYear();
  const monthName = today.toLocaleString('default', { month: 'long' });
  const daysInMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonthIdx, 1).getDay();

  const [coords, setCoords] = useState<{lat: number; lon: number} | null>(null);
  const [address, setAddress] = useState('Detecting address...');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<'granted' | 'denied' | 'default'>('default');

  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission().then(status => setNotificationStatus(status));
    }
  }, []);

  useEffect(() => {
    const checkNotification = () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const shiftStartStr = "09:00";
      const shiftEndStr = "18:00";
      const startSplit = shiftStartStr.split(':').map(Number);
      const startTime = new Date();
      startTime.setHours(startSplit[0], startSplit[1] - 10, 0);
      const startNotifyStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
      const endSplit = shiftEndStr.split(':').map(Number);
      const endTime = new Date();
      endTime.setHours(endSplit[0], endSplit[1] + 10, 0);
      const endNotifyStr = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
      if (timeStr === startNotifyStr && !isCheckedIn) {
        new Notification("Attendance Reminder", { body: "Your shift starts in 10 minutes. Please punch in.", icon: "/logo.png" });
      }
      if (timeStr === endNotifyStr && isCheckedIn) {
        new Notification("Attendance Reminder", { body: "Your shift has ended. Please remember to punch out.", icon: "/logo.png" });
      }
    };
    const interval = setInterval(checkNotification, 60000); 
    return () => clearInterval(interval);
  }, [isCheckedIn]);

  const dailyLogs = React.useMemo(() => {
    const groups: Record<string, any> = {};
    [...attendanceLogs].forEach(log => {
      const dateKey = log.date; // already YYYY-MM-DD
      if (!groups[dateKey]) {
        groups[dateKey] = { date: dateKey, punches: [], firstIn: null, lastOut: null, location: '', selfie: null };
      }
      groups[dateKey].punches.push(log);
    });
    return Object.values(groups).sort((a: any, b: any) => b.date.localeCompare(a.date)).map((day: any) => {
      const sorted = day.punches.sort((a: any, b: any) => parseTime(a.time) - parseTime(b.time));
      day.firstIn = sorted.find((p: any) => p.status === 'Checked In' || p.status === 'Late');
      day.lastOut = [...sorted].reverse().find((p: any) => p.status === 'Checked Out');
      const primary = day.firstIn || day.lastOut;
      day.location = primary?.location || 'Detecting...';
      day.selfie = primary?.selfie;
      return day;
    });
  }, [attendanceLogs]);

  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const isShiftComplete = React.useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    return attendanceLogs.some(l => l.date === todayStr && l.status === 'Checked Out');
  }, [attendanceLogs]);

  const stats = React.useMemo(() => {
    const monthLogs = dailyLogs.filter((d: any) => {
       const [y, m] = d.date.split('-').map(Number);
       return y === currentYear && (m - 1) === currentMonthIdx;
    });
    
    return {
       totalWorkingDays: monthLogs.length,
       totalLeave: userLeaves.filter(l => l.status === 'approved' || l.status === 'Approved').length,
       lateCount: monthLogs.filter((d: any) => d.firstIn?.status === 'Late').length,
       monthLogs
    };
  }, [dailyLogs, userLeaves, currentYear, currentMonthIdx]);

  const fetchLogs = async () => {
    if (!profile?.employeeId) return;
    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;

      const res = await fetch(`/api/attendance?employeeId=${profile.employeeId}`);
      if (res.ok) {
        const data = await res.json();
        setAttendanceLogs(data);
        
        // Determine status specifically for today
        const todayLogs = data.filter((l: any) => l.date === todayStr);
        if (todayLogs.length > 0) {
          const latest = [...todayLogs].sort((a: any) => parseTime(a.time))[todayLogs.length - 1];
          setIsCheckedIn(latest.status === 'Checked In' || latest.status === 'Late');
        } else {
          setIsCheckedIn(false);
        }
      }
    } catch (err) { console.error(err); }
  };

  const fetchLeaves = async () => {
    if (!profile?.employeeId) return;
    try {
      const res = await fetch(`/api/leaves?employeeId=${profile.employeeId}`);
      if (res.ok) setUserLeaves(await res.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    }, 1000);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setCoords({lat, lon});
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
          const data = await res.json();
          setAddress(data.display_name || 'Location Tracked');
        } catch { setAddress("Location active"); }
      });
    }
    
    fetchLogs();
    fetchLeaves();
    return () => clearInterval(timer);
  }, [profile.employeeId]);

  const startCamera = async () => {
    const now = new Date();
    if (isShiftComplete) return alert("You have already finished your shift for today.");
    if (!isCheckedIn && (now.getHours() > 19 || (now.getHours() === 19 && now.getMinutes() >= 30))) {
      return alert("Shift over. Punch-in is not permitted after 07:30 PM.");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      setVideoStream(stream);
      setIsCapturing(true);
    } catch { alert("Please allow camera access to take a photo."); }
  };

  const takeSnapshot = () => {
    if (videoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
        setCapturedSelfie(canvas.toDataURL('image/png'));
        videoStream?.getTracks().forEach(t => t.stop());
        setVideoStream(null);
    }
  };

  useEffect(() => {
    if (videoRef.current && videoStream) videoRef.current.srcObject = videoStream;
  }, [videoStream]);

  const handleAttendance = async () => {
    if (!capturedSelfie) return;
    const now = new Date();
    
    let finalStatus = isCheckedIn ? 'Checked Out' : 'Checked In';
    
    // Automatic Late Logic (15-Min Grace Period)
    if (!isCheckedIn && profile.expectedInTime) {
       try {
          const [expH, expM] = profile.expectedInTime.split(':').map(Number);
          const expected = new Date();
          expected.setHours(expH, expM, 0, 0);
          const graceLimit = new Date(expected.getTime() + 15 * 60 * 1000);
          if (now > graceLimit) {
             finalStatus = 'Late';
          }
       } catch (e) {
          console.error("Grace period calc error:", e);
       }
    }

    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayDate = `${yyyy}-${mm}-${dd}`;

    const newRecord = {
      userId: profile._id,
      employeeId: profile.employeeId,
      userName: profile.name,
      date: todayDate,
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: finalStatus,
      location: address,
      lat: coords?.lat,
      lon: coords?.lon,
      remark: 'Selfie Verified',
      selfie: capturedSelfie,
    };
    try {
      const res = await fetch('/api/attendance', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(newRecord) 
      });
      if (res.ok) {
        const saved = await res.json();
        setAttendanceLogs(prev => [saved, ...prev]);
        setIsCheckedIn(saved.status === 'Checked In' || saved.status === 'Late');
        setShowSuccess(true);
        setIsCapturing(false);
        setCapturedSelfie(null);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (err) { console.error(err); }
  };

  const handleLeaveSubmit = async () => {
    if (!leaveDates.start || !leaveDates.end || !leaveReason) return alert("Please fill all details");
    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile._id,
          employeeId: profile.employeeId,
          employeeName: profile.name,
          startDate: leaveDates.start,
          endDate: leaveDates.end,
          reason: leaveReason,
          status: 'pending'
        })
      });
      if (res.ok) {
        alert("Leave request submitted successfully");
        setShowLeaveModal(false);
        setLeaveReason('');
        setLeaveDates({ start: '', end: '' });
        fetchLeaves(); // Refresh timeline
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="min-h-screen bg-black text-white flex relative overflow-x-hidden font-sans selection:bg-brand-red selection:text-white">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 bg-brand-card/80 backdrop-blur-xl border-r border-brand-border flex-col p-8 sticky top-0 h-screen z-50">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-10 h-10 bg-brand-red rounded-lg flex items-center justify-center p-1 shadow-lg shadow-red-900/20">
            <Image src="/logo.png" alt="MWG" width={32} height={32} className="rounded-md" />
          </div>
          <div className="flex flex-col leading-tight">
            <strong className="text-lg font-bold">White Gloves</strong>
            <span className="text-[10px] text-zinc-600 tracking-[3px] uppercase font-black">TECHNOLOGIES</span>
          </div>
        </div>
        <nav className="flex-grow flex flex-col gap-2">
          {[
            { id: 'dashboard', icon: BarChart3, label: 'Logs' },
            { id: 'attendance', icon: Calendar, label: 'Attendance' },
            { id: 'reports', icon: TrendingUp, label: 'Stats' },
            { id: 'leave', icon: FileText, label: 'Apply Leave' }
          ].map(item => (
            <div key={item.id} onClick={() => setView(item.id as any)} className={`flex items-center gap-4 px-5 py-4 rounded-xl cursor-pointer transition-all duration-300 group ${view === item.id ? 'bg-brand-red text-white shadow-xl shadow-red-900/30' : 'hover:bg-white/5 text-zinc-500 hover:text-white'}`}>
              <item.icon size={20} className={view === item.id ? 'text-white' : 'group-hover:text-brand-red transition-colors'} />
              <span className="font-bold">{item.label}</span>
            </div>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-6">
          <button disabled={isShiftComplete} onClick={startCamera} className={`w-full py-4 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-2xl ${isShiftComplete ? 'bg-zinc-900 text-zinc-600 grayscale cursor-not-allowed' : 'bg-brand-red text-white hover:bg-red-700 shadow-red-900/40'}`}>
            {isShiftComplete ? 'SHIFT ENDED' : (isCheckedIn ? 'PUNCH OUT' : 'PUNCH IN')}
          </button>
          <div onClick={() => { localStorage.removeItem('user'); window.location.reload(); }} className="flex items-center gap-4 text-zinc-600 hover:text-white font-bold cursor-pointer transition-colors px-2">
            <LogOut size={18} /> Logout
          </div>
        </div>
      </aside>

      {/* Mobile Nav */}
      <nav className="lg:hidden fixed bottom-6 left-6 right-6 h-18 bg-brand-card/95 backdrop-blur-2xl border border-white/10 rounded-2xl flex justify-around items-center px-4 z-[100] shadow-2xl">
        {[
          { id: 'dashboard', icon: BarChart3, label: 'Logs' },
          { id: 'attendance', icon: Calendar, label: 'Calendar' },
          { id: 'reports', icon: TrendingUp, label: 'Stats' },
          { id: 'leave', icon: FileText, label: 'Leave' }
        ].map(item => (
          <button key={item.id} onClick={() => setView(item.id as any)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 ${view === item.id ? 'text-brand-red scale-110' : 'text-zinc-600'}`}>
            <item.icon size={22} />
            <span className="text-[10px] font-bold uppercase">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="flex-grow flex flex-col relative z-base overflow-y-auto bg-black">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-[60] flex items-center justify-between px-6 py-4 bg-black/80 backdrop-blur-md border-b border-white/5">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="MWG" width={32} height={32} className="rounded-lg shadow-lg" />
            <span className="font-bold text-sm tracking-tight text-white">Hello, {profile.name.split(' ')[0]}</span>
          </div>
          <button onClick={() => { localStorage.removeItem('user'); window.location.reload(); }} className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500"><LogOut size={16} /></button>
        </header>

        {/* Top Header Desktop */}
        <header className="hidden lg:flex sticky top-0 z-40 items-center justify-between px-10 py-6 bg-black/80 backdrop-blur-md border-b border-white/5">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-5 py-3 flex items-center gap-4 w-[400px]">
            <Search size={18} className="text-zinc-600" />
            <input type="text" placeholder="Search..." className="bg-transparent border-none outline-none text-sm w-full text-zinc-400 font-medium" />
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-sm font-bold text-white">{profile.name}</div>
              <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{profile.staffType}</div>
            </div>
            <div className="w-11 h-11 bg-white/5 border border-white/10 rounded-full flex items-center justify-center font-bold text-lg text-brand-red ring-2 ring-brand-red/20">{profile.name.charAt(0)}</div>
          </div>
        </header>

        <main className="flex-grow p-6 lg:p-10 pb-32 lg:pb-10 overflow-y-auto">
          {view === 'dashboard' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
              {/* Hero Status Card */}
              <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900 to-black border border-white/5 rounded-[32px] p-8 lg:p-14 shadow-2xl">
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center lg:items-end gap-10">
                  <div className="text-center lg:text-left space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Current Time</span>
                    <h1 className="text-6xl lg:text-8xl font-black tracking-tight">{currentTime}</h1>
                    <p className="text-lg lg:text-xl text-zinc-500 font-bold">{currentDate}</p>
                    <div className="flex items-center justify-center lg:justify-start gap-2 pt-4 text-zinc-600 font-bold text-xs">
                      <MapPin size={16} /> {address.length > 50 ? address.substring(0, 50) + '...' : address}
                    </div>
                  </div>
                  <button disabled={isShiftComplete} onClick={startCamera} className={`w-full lg:w-max px-12 py-6 rounded-2xl font-black text-2xl transition-all duration-300 transform active:scale-95 shadow-3xl ${isShiftComplete ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50' : (isCheckedIn ? 'bg-white text-black hover:bg-zinc-200' : 'bg-brand-red text-white hover:bg-red-700 shadow-red-900/40')}`}>
                    {isShiftComplete ? 'SHIFT ENDED' : (isCheckedIn ? 'PUNCH OUT' : 'PUNCH IN')}
                  </button>
                </div>
              </div>

              {/* Recent Logs Section */}
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-xl font-bold tracking-tight text-white uppercase italic">Work Attendance</h3>
                  <button onClick={() => setView('attendance')} className="text-brand-red text-xs font-bold uppercase tracking-widest">See All</button>
                </div>

                <div className="lg:hidden grid gap-4">
                  {dailyLogs.slice(0, 3).map((day: any, i) => (
                    <div key={i} onClick={() => { setView('attendance'); setExpandedDay(day.date); }} className="bg-brand-card/50 border border-brand-border p-5 rounded-2xl active:scale-95 transition-all flex flex-col gap-4">
                      <div className="flex items-center justify-between text-zinc-500">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                          <Calendar size={14} className="text-brand-red" /> {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        {day.lastOut && <div className="text-green-500 text-[10px] font-bold uppercase bg-green-500/10 px-2 py-1 rounded">Verified</div>}
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-zinc-700 uppercase">In</span>
                          <span className={`text-xl font-black ${day.firstIn ? 'text-green-500' : 'text-zinc-900'}`}>{day.firstIn?.time || '--:--'}</span>
                        </div>
                        <div className="text-zinc-800 font-thin text-2xl">/</div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-zinc-700 uppercase">Out</span>
                          <span className={`text-xl font-black ${day.lastOut ? 'text-red-500' : (day.firstIn ? 'text-white italic' : 'text-zinc-900')}`}>{day.lastOut?.time || (day.firstIn ? 'ACTIVE' : '--:--')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden lg:block bg-brand-card/20 border border-brand-border rounded-3xl overflow-hidden shadow-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/5">
                        <th className="px-8 py-5 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Date</th>
                        <th className="px-8 py-5 text-[10px] font-black text-zinc-600 uppercase tracking-widest">In</th>
                        <th className="px-8 py-5 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Out</th>
                        <th className="px-8 py-5 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Verification</th>
                        <th className="px-8 py-5 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyLogs.slice(0, 5).map((day: any, i) => (
                        <tr key={i} onClick={() => setExpandedDay(expandedDay === day.date ? null : day.date)} className="group cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5">
                          <td className="px-8 py-6 font-bold text-zinc-300">{new Date(day.date).toLocaleDateString()}</td>
                          <td className="px-8 py-6 text-green-500 font-black text-lg">{day.firstIn?.time || '--'}</td>
                          <td className="px-8 py-6">{day.lastOut ? <span className="text-red-500 font-black text-lg">{day.lastOut.time}</span> : (day.firstIn ? <span className="px-3 py-1 bg-green-500/10 text-green-500 text-[10px] font-bold rounded">ACTIVE</span> : <span className="text-zinc-900 font-black">--</span>)}</td>
                          <td className="px-8 py-6">
                            {day.selfie && <div className="w-12 h-12 rounded-lg border border-white/10 overflow-hidden shadow-lg"><img src={day.selfie} alt="Verified" className="w-full h-full object-cover" /></div>}
                          </td>
                          <td className="px-8 py-6 text-zinc-600 text-xs font-bold truncate max-w-[200px]">{day.location}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {view === 'attendance' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-2">
                <div>
                  <h2 className="text-3xl font-black tracking-tight underline decoration-brand-red decoration-4">Monthly Attendance</h2>
                  <p className="text-zinc-600 font-bold uppercase text-[10px] tracking-widest mt-1">{monthName} {currentYear}</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-zinc-500"><div className="w-2 h-2 bg-green-500 rounded-full"></div> Present</div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-zinc-500"><div className="w-2 h-2 bg-zinc-900 rounded-full"></div> Expected</div>
                </div>
              </div>

              <div className="bg-brand-card/30 border border-brand-border p-6 lg:p-10 rounded-3xl">
                <div className="grid grid-cols-7 gap-2 lg:gap-4">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <div key={d} className="text-center text-[10px] font-black text-zinc-700 uppercase tracking-widest mb-4">{d}</div>
                  ))}
                  {[...Array(firstDayOfMonth)].map((_, i) => <div key={`e-${i}`} />)}
                  {[...Array(daysInMonth)].map((_, i) => {
                    const dayNum = i + 1;
                    const dStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const isPresent = dailyLogs.some((d: any) => d.date === dStr);
                    const isToday = dayNum === today.getDate() && currentMonthIdx === today.getMonth();
                    return (
                      <div key={dayNum} className={`relative aspect-square lg:h-24 bg-white/5 border border-white/5 rounded-xl lg:rounded-2xl p-2 lg:p-4 transition-all duration-300 group hover:bg-white/10 ${isPresent ? 'border-green-500/30 bg-green-500/5' : ''} ${isToday ? 'border-brand-red ring-1 ring-brand-red/50 !bg-brand-red/5' : ''}`}>
                        <span className={`text-base lg:text-xl font-black ${isPresent ? 'text-green-500' : (isToday ? 'text-white' : 'text-zinc-800')}`}>{dayNum}</span>
                        {isPresent && <div className="absolute right-2 bottom-2 w-1.5 h-1.5 bg-green-500 rounded-full shadow-lg shadow-green-900/50"></div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          
          {view === 'reports' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Total Present', val: stats.totalWorkingDays, icon: Calendar, color: 'text-white' },
                  { label: 'Leave Approved', val: stats.totalLeave, icon: FileText, color: 'text-zinc-600' },
                  { label: 'Late Entries', val: stats.lateCount, icon: Clock, color: 'text-brand-red' }
                ].map((s, i) => (
                  <div key={i} className="bg-brand-card/50 border border-brand-border p-8 rounded-3xl flex justify-between items-center transition-all hover:border-brand-red/20 group">
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest">{s.label}</div>
                      <div className={`text-4xl font-black ${s.color}`}>{s.val}</div>
                    </div>
                    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-700 group-hover:text-brand-red group-hover:bg-brand-red/5 transition-all"><s.icon size={24} /></div>
                  </div>
                ))}
              </div>
              <div className="bg-brand-card/30 border border-brand-border p-8 lg:p-12 rounded-[32px] h-64 flex flex-col justify-between">
                 <div>
                    <h3 className="text-xl font-bold text-zinc-100 italic uppercase">Activity Chart</h3>
                    <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest">Consistency Mapping Nodes</p>
                 </div>
                 <div className="flex items-end justify-between h-32 gap-1 lg:gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {[...Array(daysInMonth)].map((_, i) => {
                       const d = i + 1;
                       const dStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                       const log = dailyLogs.find((dl: any) => dl.date === dStr);
                       return (
                          <div key={i} className="flex flex-col items-center gap-2 min-w-[8px] flex-grow">
                             <div className={`w-full rounded-full transition-all duration-700 origin-bottom ${log ? 'bg-brand-red h-24' : 'bg-zinc-900 h-2'}`}></div>
                             <span className="text-[8px] font-black text-zinc-800">{d}</span>
                          </div>
                       );
                    })}
                 </div>
              </div>
            </div>
          )}

          {view === 'leave' && (
            <div className="max-w-4xl mx-auto space-y-12 animate-fade-in pb-20">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                  <h2 className="text-4xl font-black tracking-tight underline decoration-brand-red decoration-4 uppercase italic">Leave Control</h2>
                  <p className="text-zinc-600 font-bold uppercase text-[10px] tracking-widest">Track & Manage your Applications</p>
                </div>
                <button onClick={() => setShowLeaveModal(true)} className="px-8 py-5 bg-brand-red text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-xl shadow-red-900/40">Open New Node</button>
              </div>

              {/* Status Timeline View */}
              <div className="space-y-6">
                 <h3 className="text-sm font-black uppercase text-zinc-700 border-l-2 border-brand-red pl-4">Creative Timeline</h3>
                 <div className="space-y-4">
                    {userLeaves.length === 0 ? (
                      <div className="bg-brand-card/20 border border-brand-border p-12 rounded-[32px] text-center">
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 text-zinc-800"><FileText size={32}/></div>
                        <p className="text-zinc-600 font-bold uppercase text-xs tracking-widest">No Leave History Data Sync</p>
                      </div>
                    ) : (
                      userLeaves.map((l, i) => (
                        <div key={i} className="bg-brand-card/40 border border-brand-border p-8 rounded-[32px] hover:border-white/10 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative group overflow-hidden">
                           <div className="absolute top-0 left-0 w-1 h-full bg-brand-red opacity-0 group-hover:opacity-100 transition-all"></div>
                           <div className="space-y-4 flex-grow">
                              <div className="flex items-center gap-4">
                                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
                                   l.status === 'approved' ? 'bg-green-500/10 text-green-500' : 
                                   l.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 
                                   'bg-yellow-500/10 text-yellow-500 animate-pulse'
                                 }`}>
                                    {l.status === 'approved' ? '✅' : l.status === 'rejected' ? '❌' : '⏳'}
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase text-zinc-600 tracking-tighter">Current Status</span>
                                    <span className={`text-xs font-black uppercase ${
                                      l.status === 'approved' ? 'text-green-500' : 
                                      l.status === 'rejected' ? 'text-red-500' : 
                                      'text-yellow-500'
                                    }`}>{l.status}</span>
                                 </div>
                              </div>
                              <div className="space-y-1">
                                 <p className="text-lg font-bold text-white tracking-tight">{l.reason}</p>
                                 <div className="flex items-center gap-3 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                                    <Calendar size={12}/> {new Date(l.startDate).toLocaleDateString()} — {new Date(l.endDate).toLocaleDateString()}
                                 </div>
                              </div>
                           </div>
                           {l.adminNote && (
                              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl md:max-w-xs w-full">
                                 <p className="text-[9px] font-black uppercase text-brand-red mb-1">Admin Response</p>
                                 <p className="text-xs text-zinc-400 leading-relaxed font-medium">"{l.adminNote}"</p>
                              </div>
                           )}
                        </div>
                      ))
                    )}
                 </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Camera Verification Modal */}
      {isCapturing && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[1000] flex items-center justify-center p-6">
            <div className="bg-brand-card/50 border border-brand-border w-full max-w-xl p-8 lg:p-10 rounded-[32px] space-y-8 animate-fade-in">
               <div className="flex items-center justify-between border-b border-white/5 pb-6">
                  <h3 className="text-xl font-bold uppercase italic flex items-center gap-3"><Camera size={20} className="text-brand-red" /> Verification</h3>
                  <button onClick={() => { setIsCapturing(false); videoStream?.getTracks().forEach(t=>t.stop()); }} className="text-zinc-600 hover:text-white"><X size={24} /></button>
               </div>
               <div className="aspect-[4/3] w-full bg-black rounded-2xl overflow-hidden border border-white/10 relative group">
                  {!capturedSelfie ? <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale brightness-110" /> : <img src={capturedSelfie} alt="Verified" className="w-full h-full object-cover" />}
                  <div className="absolute inset-0 pointer-events-none border-[12px] border-black/20 ring-1 ring-white/10 rounded-2xl"></div>
               </div>
               <div className="grid gap-4">
                  {!capturedSelfie ? (
                    <button onClick={takeSnapshot} className="py-5 bg-brand-red text-white text-lg font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all active:scale-95 shadow-xl shadow-red-900/30">Take Photo</button>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                       <button onClick={handleAttendance} className="py-5 bg-green-600 text-white font-black text-lg rounded-xl hover:bg-green-700 transition-all">Submit</button>
                       <button onClick={() => { setCapturedSelfie(null); startCamera(); }} className="py-5 bg-zinc-800 text-zinc-400 font-bold rounded-xl hover:text-white">Retake</button>
                    </div>
                  )}
               </div>
            </div>
          </div>
      )}

      {/* Leave Application Modal */}
      {showLeaveModal && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[1000] flex items-center justify-center p-6">
             <div className="bg-brand-card border border-white/10 w-full max-w-lg p-8 lg:p-10 rounded-[32px] space-y-8">
                <div className="space-y-1">
                   <h3 className="text-2xl font-black uppercase tracking-tight">Apply for Leave</h3>
                   <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest">Fill details for HR approval</p>
                </div>
                <textarea placeholder="Write reason for leave..." className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-brand-red/50 transition-all" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} />
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest pl-1">Start Date</p>
                      <input type="date" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" value={leaveDates.start} onChange={(e) => setLeaveDates({ ...leaveDates, start: e.target.value })} />
                   </div>
                   <div className="space-y-1">
                      <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest pl-1">End Date</p>
                      <input type="date" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" value={leaveDates.end} onChange={(e) => setLeaveDates({ ...leaveDates, end: e.target.value })} />
                   </div>
                </div>
                <div className="grid gap-3">
                   <button onClick={handleLeaveSubmit} className="py-4 bg-brand-red text-white rounded-xl font-bold active:scale-95 transition-all shadow-xl shadow-red-900/10">SUBMIT FOR APPROVAL</button>
                   <div className="h-px bg-white/5 my-2"></div>
                   <button onClick={() => window.open(`https://wa.me/919798324189?text=${encodeURIComponent(`*Leave Application*\nEmployee: ${profile.name}\nDates: ${leaveDates.start} to ${leaveDates.end}\nReason: ${leaveReason}`)}`, '_blank')} className="py-4 bg-[#25D366] text-white rounded-xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all"><MessageSquare size={18} /> Notify via WhatsApp</button>
                   <button onClick={() => window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=franchise@mrwhitegloves.com&su=Leave Request - ${profile.name}&body=${leaveReason}`, '_blank')} className="py-4 bg-white text-black rounded-xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all"><Mail size={18} /> Notify via Gmail</button>
                   <button onClick={() => setShowLeaveModal(false)} className="py-3 text-zinc-700 text-xs font-bold uppercase hover:text-zinc-500">Cancel</button>
                </div>
             </div>
          </div>
      )}

      {/* Success Notification */}
      {showSuccess && (
        <div className="fixed bottom-32 lg:bottom-12 left-1/2 -translate-x-1/2 z-[2000] animate-bounce">
           <div className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold shadow-2xl flex items-center gap-3"><CheckCircle2 size={20} /> Verified Successfully</div>
        </div>
      )}
    </div>
  );
}

// Footer helper
