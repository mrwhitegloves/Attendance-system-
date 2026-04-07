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
  LogOut
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

export default function AttendanceSystem({ profile }: { profile: { name: string; employeeId: string; department: string; staffType: 'Office Staff' | 'Field Staff', createdAt?: string } }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [view, setView] = useState<'dashboard' | 'attendance' | 'reports' | 'leave'>('dashboard');
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([]);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [leaves, setLeaves] = useState<{ date: string; reason: string; status: 'Pending' | 'Approved' }[]>([]);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveDates, setLeaveDates] = useState({ start: '', end: '' });

  // Get current month info for calendar
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

  // PWA Notification Logic
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

      // Config (Workforce IQ Standard Shifts)
      const shiftStartStr = "09:00";
      const shiftEndStr = "18:00";

      // 10 mins before start
      const startSplit = shiftStartStr.split(':').map(Number);
      const startTime = new Date();
      startTime.setHours(startSplit[0], startSplit[1] - 10, 0);
      const startNotifyStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;

      // 10 mins after end
      const endSplit = shiftEndStr.split(':').map(Number);
      const endTime = new Date();
      endTime.setHours(endSplit[0], endSplit[1] + 10, 0);
      const endNotifyStr = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;

      if (timeStr === startNotifyStr && !isCheckedIn) {
        new Notification("White Gloves Workforce IQ", {
          body: "Reminder: Your shift starts in 10 minutes. Please prepare to punch in.",
          icon: "/logo.png"
        });
      }

      if (timeStr === endNotifyStr && isCheckedIn) {
        new Notification("White Gloves Workforce IQ", {
          body: "Notice: Your shift ended 10 minutes ago. Please remember to punch out.",
          icon: "/logo.png"
        });
      }
    };

    const interval = setInterval(checkNotification, 60000); 
    return () => clearInterval(interval);
  }, [isCheckedIn]);

  // Group logs by DATE and NORMALIZE keys to avoid duplicates
  const dailyLogs = React.useMemo(() => {
    const groups: Record<string, any> = {};
    
    [...attendanceLogs].forEach(log => {
      // Normalize to YYYY-MM-DD
      const dateKey = new Date(log.date).toLocaleDateString('en-CA');
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          punches: [],
          firstIn: null,
          lastOut: null,
          location: '',
          selfie: null
        };
      }
      groups[dateKey].punches.push(log);
    });

    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date)).map(day => {
      const sorted = day.punches.sort((a: any, b: any) => a.time.localeCompare(b.time));
      day.firstIn = sorted.find((p: any) => p.status === 'Checked In');
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

  // Month Statistics for Reports
  const stats = React.useMemo(() => {
    const monthLogs = dailyLogs.filter(d => {
       const [y, m] = d.date.split('-').map(Number);
       return y === currentYear && (m - 1) === currentMonthIdx;
    });
    
    return {
       totalWorkingDays: monthLogs.length,
       totalLeave: leaves.filter(l => l.status === 'Approved').length, // Current month only (simple length for now)
       lateCount: monthLogs.filter(d => {
          if(!d.firstIn) return false;
          const [h, min] = d.firstIn.time.split(' ')[0].split(':').map(Number);
          const isPM = d.firstIn.time.includes('PM');
          const hours24 = (isPM && h < 12) ? h + 12 : (isPM && h === 12 ? 12 : h);
          return hours24 > 10 || (hours24 === 10 && min > 45); // Late after 10:45 AM
       }).length,
       monthLogs
    };
  }, [dailyLogs, leaves]);

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
        } catch { setAddress("Address tracking active"); }
      });
    }

    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/attendance?employeeId=${profile.employeeId}`);
        if (res.ok) {
          const data = await res.json();
          setAttendanceLogs(data);
          if(data.length > 0) {
             const latest = [...data].sort((a, b) => new Date(`${b.date} ${b.time}`).getTime() - new Date(`${a.date} ${a.time}`).getTime())[0];
             setIsCheckedIn(latest.status === 'Checked In');
          }
        }
      } catch (err) { console.error(err); }
    };
    fetchLogs();

    return () => clearInterval(timer);
  }, [profile.employeeId]);

  const startCamera = async () => {
    const now = new Date();
    if (isShiftComplete) return alert("Your shift for today is already completed and verified. No further punches are permitted.");
    if (!isCheckedIn && (now.getHours() > 19 || (now.getHours() === 19 && now.getMinutes() >= 30))) {
      return alert("Shift over. Punch-in is not permitted after 07:30 PM.");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      setVideoStream(stream);
      setIsCapturing(true);
    } catch { alert("Please enable camera permissions to verify attendance."); }
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
    const newRecord = {
      employeeId: profile.employeeId,
      date: now.toLocaleDateString('en-CA'),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: isCheckedIn ? 'Checked Out' : 'Checked In',
      location: address,
      lat: coords?.lat,
      lon: coords?.lon,
      remark: 'Verified Punch',
      selfie: capturedSelfie,
    };

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord),
      });

      if (res.ok) {
        const saved = await res.json();
        setAttendanceLogs(prev => [saved, ...prev]);
        setIsCheckedIn(saved.status === 'Checked In');
        setShowSuccess(true);
        setIsCapturing(false);
        setCapturedSelfie(null);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="app-container">
      <div className="bg-vfx-container">
        <div className="vfx-circle v1"></div>
        <div className="vfx-circle v2"></div>
        <div className="vfx-dots"></div>
      </div>
      {/* Premium Sidebar */}
      {/* Premium Sidebar - Desktop Only */}
      <aside className="sidebar desktop-only">
        <div className="brand-logo">
          <div className="logo-sq">
             <Image src="/logo.png" alt="MWG" width={36} height={36} style={{borderRadius:'8px'}} />
          </div>
          <div className="logo-text">
            <strong>White Gloves</strong>
            <span>TECHNOLOGIES</span>
          </div>
        </div>

        <nav className="nav-menu">
          <div className={`nav-link ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
            <BarChart3 size={18} /> Dashboard
          </div>
          <div className={`nav-link ${view === 'attendance' ? 'active' : ''}`} onClick={() => setView('attendance')}>
            <Calendar size={18} /> Attendance
          </div>
          <div className={`nav-link ${view === 'reports' ? 'active' : ''}`} onClick={() => setView('reports')}>
             <TrendingUp size={18} /> Reports
          </div>
          <div className={`nav-link ${view === 'leave' ? 'active' : ''}`} onClick={() => setView('leave')}>
            <FileText size={18} /> Leave
          </div>
        </nav>

        {/* PWA Alert Status Badge */}
        <div className="alert-status-box">
           <div className={`alert-indicator ${notificationStatus === 'granted' ? 'active' : ''}`}>
              <div className="a-glow"></div>
              <Clock size={14} />
           </div>
           <div className="a-text">
              <strong>System Alerts</strong>
              <span>{notificationStatus === 'granted' ? 'Active & Monitoring' : 'Requires Permission'}</span>
           </div>
        </div>

        <div className="sidebar-footer">
          <button className={`btn-side-punch ${isShiftComplete ? 'disabled' : ''}`} onClick={startCamera} disabled={isShiftComplete}>
            {isShiftComplete ? 'SHIFT ENDED' : (isCheckedIn ? 'PUNCH OUT' : 'PUNCH IN')}
          </button>
          
          <div className="logout-area" onClick={() => { localStorage.removeItem('user'); window.location.reload(); }}>
             Logout <span>N</span>
          </div>
        </div>
      </aside>

      {/* Bottom Nav - Mobile Only */}
      <nav className="bottom-nav mobile-only">
        <button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
          <BarChart3 size={22} />
          <span>Dashboard</span>
        </button>
        <button className={`nav-item ${view === 'attendance' ? 'active' : ''}`} onClick={() => setView('attendance')}>
          <Calendar size={22} />
          <span>Attendance</span>
        </button>
        <button className={`nav-item ${view === 'reports' ? 'active' : ''}`} onClick={() => setView('reports')}>
          <TrendingUp size={22} />
          <span>Reports</span>
        </button>
        <button className={`nav-item ${view === 'leave' ? 'active' : ''}`} onClick={() => setView('leave')}>
          <FileText size={22} />
          <span>Leave</span>
        </button>
      </nav>

      <div className="main-layout">
        {/* Mobile Header - High Fidelity */}
        <header className="mobile-header mobile-only">
           <div className="m-h-brand">
              <Image src="/logo.png" alt="MWG" width={28} height={28} style={{borderRadius:'6px'}} />
              <span>{profile.name.split(' ')[0]}</span>
           </div>
           <button className="m-logout-btn" onClick={() => { localStorage.removeItem('user'); window.location.reload(); }}>
              <LogOut size={20} />
           </button>
        </header>

        <header className="top-header desktop-only">
           <div className="search-bar">
              <Search size={18} color="#555" />
              <input type="text" placeholder="Search operations..." />
           </div>
           
           <div className="header-meta">
              <div className="user-profile">
                 <div className="u-info">
                    <strong>{profile.name}</strong>
                    <span>{profile.staffType || 'Member'}</span>
                 </div>
                 <div className="u-avatar">{profile.name.charAt(0)}</div>
              </div>
           </div>
        </header>

        <main className="view-content">
          {view === 'dashboard' && (
            <div className="dashboard-root fade-in">
                {/* Mobile Hero View */}
                <div className="mobile-only mobile-hero-box system-card">
                   <div className="m-time-display">
                      <span className="m-label">SYSTEM TIME</span>
                      <div className="m-clock">{currentTime}</div>
                      <div className="m-date">{currentDate}</div>
                   </div>
                   <div className="m-loc-info">
                      📍 {address.length > 40 ? address.substring(0, 40) + '...' : address}
                   </div>
                   <button className={`m-punch-btn ${isCheckedIn ? 'punched' : ''} ${isShiftComplete ? 'disabled' : ''}`} onClick={startCamera} disabled={isShiftComplete}>
                      <div className="m-p-ripple"></div>
                      <div className="m-p-content">
                         <Clock size={32} />
                         <span>{isShiftComplete ? 'SHIFT ENDED' : (isCheckedIn ? 'PUNCH OUT' : 'PUNCH IN')}</span>
                      </div>
                   </button>
                </div>

               {/* Desktop Hero View */}
               <div className="desktop-only system-card card-vfx">
                 <div className="card-row">
                   <div className="time-info">
                      <span className="tag">SYSTEM TIME STATUS</span>
                      <h1 className="clock">{currentTime}</h1>
                      <p className="date">{currentDate}</p>
                      <div className="loc-pin">
                         📍 {address.length > 70 ? address.substring(0, 70) + '...' : address}
                      </div>
                   </div>
                   
                   <div className="action-pane">
                      <button 
                        className={`punch-hero-btn ${isCheckedIn ? 'out' : 'in'}`}
                        onClick={startCamera}
                      >
                         {isShiftComplete ? 'SHIFT ENDED' : (isCheckedIn ? 'PUNCH OUT' : 'PUNCH IN')}
                      </button>
                   </div>
                 </div>
               </div>

               <div className="ledger-header">
                  <h3>Recent Attendance Logs</h3>
                  <span className="ledger-link desktop-only" onClick={() => setView('attendance')}>VIEW DETAILED REPORT</span>
               </div>

               {/* Mobile Logs View */}
               <div className="mobile-only m-logs-stack">
                  {dailyLogs.slice(0, 5).map((day, i) => (
                      <div key={i} className="m-log-tile" onClick={() => { setView('attendance'); setExpandedDay(day.date); }}>
                         <div className="tile-date">
                            <Calendar size={14} /> <span>{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                         </div>
                         <div className="tile-hours">
                            <div className="h-box in">
                               <small>In</small>
                               <strong>{day.firstIn?.time || '--:--'}</strong>
                            </div>
                            <div className="h-div">→</div>
                            <div className="h-box out">
                               <small>Out</small>
                               <strong>{day.lastOut?.time || (day.firstIn ? 'ACTIVE' : '--:--')}</strong>
                            </div>
                         </div>
                         {day.lastOut && <div className="m-verify-tag"><div className="pulse-dot"></div> Verified</div>}
                      </div>
                  ))}
               </div>

               {/* Desktop Logs View */}
               <div className="ledger-container desktop-only">
                  <table className="ledger-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>PUNCH IN</th>
                        <th>PUNCH OUT</th>
                        <th>VERIFICATION</th>
                        <th>LOCATION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyLogs.slice(0, 7).map((day, i) => (
                        <React.Fragment key={i}>
                          <tr 
                            className={`ledger-row ${expandedDay === day.date ? 'active-row' : ''}`} 
                            onClick={() => setExpandedDay(expandedDay === day.date ? null : day.date)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td className="l-date">
                               <strong>{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</strong>
                            </td>
                            <td className="l-time in">
                               {day.firstIn?.time || '--'}
                            </td>
                            <td className="l-time out">
                              {day.lastOut?.time || (day.firstIn ? <span className="status-badge">ACTIVE</span> : '--')}
                            </td>
                            <td className="l-verify">
                              <div className="verify-stack">
                                 {day.selfie && (
                                   <div className="thumb-v">
                                      <img src={day.selfie} alt="Verification" />
                                      <span>{day.firstIn ? 'IN' : 'OT'}</span>
                                   </div>
                                 )}
                                 {day.punches.length > 2 && (
                                   <div className="more-count">+{day.punches.length - 2}</div>
                                 )}
                              </div>
                            </td>
                            <td className="l-loc">
                               📍 {day.location.length > 30 ? day.location.substring(0, 30) + '...' : day.location}
                            </td>
                          </tr>
                          
                          {/* Expanded Day Details */}
                          {expandedDay === day.date && (
                             <tr className="day-details fade-in">
                                <td colSpan={5}>
                                   <div className="detail-panel">
                                      <div className="session-grid">
                                         {day.punches.map((p: any, idx: number) => (
                                            <div key={idx} className="punch-item">
                                               <div className="p-photo">
                                                  <img src={p.selfie} alt="Punch Photo" />
                                                  <span className={`p-tag ${p.status.toLowerCase().replace(' ', '-')}`}>{p.status}</span>
                                               </div>
                                               <div className="p-info">
                                                  <strong>{p.time}</strong>
                                                  <p>📍 {p.location}</p>
                                               </div>
                                            </div>
                                         ))}
                                      </div>
                                   </div>
                                </td>
                             </tr>
                          )}
                        </React.Fragment>
                      ))}
                      {dailyLogs.length === 0 && (
                        <tr><td colSpan={5} style={{textAlign:'center', padding:'3rem', color:'#444'}}>No logs found</td></tr>
                      )}
                    </tbody>
                  </table>
               </div>
            </div>
          )}

          {view === 'attendance' && (
            <div className="attendance-view fade-in">
               <div className="cal-header">
                  <h2>Overall Performance: {monthName} {currentYear}</h2>
                  <div className="cal-legend">
                     <div className="l-item"><span className="l-dot p"></span> Present</div>
                     <div className="l-item"><span className="l-dot a"></span> Pending</div>
                  </div>
               </div>

               <div className="calendar-card">
                  <div className="cal-grid-base">
                     {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="cal-weekday">{d}</div>)}
                     
                     {[...Array(firstDayOfMonth)].map((_, i) => <div key={`e-${i}`} className="cal-day empty" />)}
                     
                     {[...Array(daysInMonth)].map((_, i) => {
                        const dayNum = i + 1;
                        // Build day key matching dailyLogs (YYYY-MM-DD)
                        const dStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                        const isPresent = dailyLogs.some(d => d.date === dStr);
                        const isToday = dayNum === today.getDate() && currentMonthIdx === today.getMonth();

                        return (
                           <div key={dayNum} className={`cal-day-box ${isPresent ? 'is-present' : ''} ${isToday ? 'is-today' : ''}`}>
                              <span className="d-num">{dayNum}</span>
                              {isPresent && <div className="p-indicator">PRESENT</div>}
                           </div>
                        );
                     })}
                  </div>
               </div>
            </div>
          )}
          
          {view === 'reports' && (
            <div className="reports-view fade-in">
               <div className="reports-top">
                  <div className="stat-pill red-side">
                     <span>WORKING DAYS</span>
                     <strong>{stats.totalWorkingDays}</strong>
                  </div>
                  <div className="stat-pill">
                     <span>MONTHLY LEAVE</span>
                     <strong>{stats.totalLeave}</strong>
                  </div>
                  <div className="stat-pill">
                     <span>LATE ARRIVALS</span>
                     <strong style={{color:'#e61e2a'}}>{stats.lateCount}</strong>
                  </div>
               </div>

               <div className="reports-grid">
                  <div className="chart-card">
                     <div className="card-top">
                        <h3>Productivity Trends</h3>
                        <p>Presence activity for the current month</p>
                     </div>
                     <div className="bar-chart-v">
                        {[...Array(daysInMonth)].map((_, i) => {
                           const dayNum = i + 1;
                           const dStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                           const log = dailyLogs.find(d => d.date === dStr);
                           
                           // Calculate height based on hours worked (0 to 10h)
                           let hPercent = 0;
                           if (log?.firstIn && log?.lastOut) {
                              const parseT = (t: string) => {
                                 const [time, mod] = t.split(' ');
                                 let [h, m] = time.split(':').map(Number);
                                 if(mod === 'PM' && h < 12) h += 12;
                                 if(mod === 'AM' && h === 12) h = 0;
                                 return h + (m/60);
                              };
                              const duration = parseT(log.lastOut.time) - parseT(log.firstIn.time);
                              hPercent = Math.min(100, Math.max(10, (duration / 10) * 100)); // Scale to max 10h
                           } else if (log) {
                              hPercent = 30; // Min height for activity
                           }

                           return (
                              <div key={i} className="bar-wrapper">
                                 <div className={`bar-pillar ${log ? 'filled' : ''}`} style={{ height: log ? `${hPercent}px` : '5px' }}></div>
                                 <span className="bar-label">{dayNum}</span>
                              </div>
                           );
                        })}
                     </div>
                  </div>

                  <div className="chart-card heatmap-card">
                     <h3>Attendance Heatmap</h3>
                     <div className="heatmap-box">
                        {[...Array(35)].map((_, i) => {
                           // Last 35 days heatmap
                           const d = new Date();
                           d.setDate(d.getDate() - (34 - i));
                           const key = d.toLocaleDateString('en-CA');
                           const isPresent = dailyLogs.some(log => log.date === key);
                           return (
                              <div key={i} className="heat-sq" title={key} style={{background: isPresent ? '#00ff0a' : '#1a1a1a', opacity: isPresent ? 1 : 0.3}}></div>
                           );
                        })}
                     </div>
                     <p className="heat-legend">Visualizing last 5 weeks of performance</p>
                  </div>
               </div>
            </div>
          )}
          {view === 'leave' && (
             <div className="leave-view-mobile fade-in">
                <div className="mobile-only-leave-header">
                   <h2>Time Off Portal</h2>
                   <p>Submit your formal leave applications directly to the franchise hub for verification.</p>
                </div>
                <button className="apply-leave-btn-hero" onClick={() => setShowLeaveModal(true)}>
                   <FileText size={32} />
                   <span>Apply for Leave</span>
                </button>
             </div>
          )}
        </main>
      </div>

      {isCapturing && (
          <div className="capture-modal">
            <div className="modal-content">
               <h3>Identity Verification</h3>
               <div className="cam-box">
                  {!capturedSelfie ? (
                    <video ref={videoRef} autoPlay playsInline muted />
                  ) : (
                    <img src={capturedSelfie} alt="Preview" />
                  )}
               </div>
               <div className="modal-btns">
                  {!capturedSelfie ? (
                    <button className="confirm-btn" onClick={takeSnapshot}>Take Photo</button>
                  ) : (
                    <>
                      <button className="confirm-btn" style={{background:'#28a745'}} onClick={handleAttendance}>Submit Attendance</button>
                      <button className="retake-btn" onClick={() => { setCapturedSelfie(null); startCamera(); }}>Retake</button>
                    </>
                  )}
                  <button className="close-btn" onClick={() => { setIsCapturing(false); videoStream?.getTracks().forEach(t=>t.stop()); }}>Cancel</button>
               </div>
            </div>
          </div>
      )}

      {showLeaveModal && (
          <div className="capture-modal" style={{zIndex:2000}}>
             <div className="modal-content">
                <h3>Request Formal Leave</h3>
                <textarea 
                  placeholder="Reason for leave..."
                  style={{width:'100%', background:'#111', border:'1px solid #333', borderRadius:'12px', padding:'1rem', color:'#fff', height:'120px', margin:'1rem 0'}}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                />
                <div className="modal-btns">
                   <button className="confirm-btn" onClick={() => {
                      if(!leaveReason) return alert("Please Provide Reason");
                      setShowLeaveModal(false); 
                      alert("Leave Request Logged Successfully"); 
                   }}>Submit Request</button>
                   
                   <div style={{display:'flex', gap:'1rem', marginTop:'1rem'}}>
                      <button className="retake-btn" style={{flex:1, color:'#fff', background:'rgba(230,30,42,0.1)', border:'1px solid rgba(230,30,42,0.2)'}} onClick={() => window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=franchise@mrwhitegloves.com&su=${encodeURIComponent(`Leave - ${profile.name}`)}&body=${encodeURIComponent(`Reason: ${leaveReason}`)}`, '_blank')}>
                         🔴 Gmail HR
                      </button>
                      <button className="retake-btn" style={{flex:1, color:'#fff', background:'rgba(0,255,10,0.1)', border:'1px solid rgba(0,255,10,0.2)'}} onClick={() => window.open(`https://wa.me/919798324189?text=${encodeURIComponent(`*Leave Application*
Employee: ${profile.name}
Reason: ${leaveReason}`)}`, '_blank')}>
                         🟢 WhatsApp
                      </button>
                   </div>

                   <button className="close-btn" onClick={() => setShowLeaveModal(false)}>Close</button>
                </div>
             </div>
          </div>
      )}

      {showSuccess && (
        <div className="success-overlay">
           <div className="success-toast">
              🎉 Attendance Marked!
           </div>
        </div>
      )}

      <style jsx>{`
        .bg-vfx-container {
          position: fixed;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .vfx-circle {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.1;
          background: radial-gradient(circle, #e61e2a 0%, transparent 70%);
        }
        .vfx-circle.v1 {
          width: 600px;
          height: 600px;
          top: -200px;
          left: -200px;
          animation: moveV1 20s infinite alternate ease-in-out;
        }
        .vfx-circle.v2 {
          width: 500px;
          height: 500px;
          bottom: -150px;
          right: -150px;
          animation: moveV2 25s infinite alternate ease-in-out;
        }
        @keyframes moveV1 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(100px, 150px) scale(1.2); }
        }
        @keyframes moveV2 {
          0% { transform: translate(0, 0) scale(1.2); }
          100% { transform: translate(-150px, -100px) scale(1); }
        }
        .vfx-dots {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(#e61e2a 1px, transparent 1px);
          background-size: 40px 40px;
          opacity: 0.05;
        }

        .app-container {
          display: flex;
          min-height: 100vh;
          background: #000000;
          color: #ffffff;
          font-family: 'Inter', sans-serif;
          position: relative;
        }

        .sidebar, .main-layout {
          position: relative;
          z-index: 10;
        }

        .sidebar {
          width: 260px;
          background: #0a0a0a;
          border-right: 1px solid rgba(255,255,255,0.05);
          display: flex;
          flex-direction: column;
          padding: 2rem 1.5rem;
          position: sticky;
          top: 0;
          height: 100vh;
          z-index: 100;
        }

        .brand-logo { display: flex; align-items: center; gap: 1rem; margin-bottom: 3.5rem; }
        .logo-sq { width: 42px; height: 42px; background: #e61e2a; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.4rem; color: white; }
        .logo-text { display: flex; flex-direction: column; line-height: 1.2; }
        .logo-text strong { font-size: 1.1rem; }
        .logo-text span { font-size: 0.6rem; color: #555; letter-spacing: 2px; text-transform: uppercase; }

        .nav-menu { flex-grow: 1; display: flex; flex-direction: column; gap: 0.5rem; }
        .nav-link { padding: 0.9rem 1.2rem; border-radius: 12px; cursor: pointer; transition: 0.3s; color: #888; display: flex; align-items: center; gap: 1rem; font-weight: 500; font-size: 0.95rem; }
        .nav-link:hover { color: white; background: rgba(255,255,255,0.02); }
        .nav-link.active { background: #e61e2a; color: white; box-shadow: 0 4px 20px rgba(230, 30, 42, 0.3); }

        .sidebar-footer { margin-top: auto; display: flex; flex-direction: column; gap: 1.5rem; }
        .btn-side-punch { width: 100%; padding: 1.2rem; background: #e61e2a; border: none; border-radius: 12px; color: white; font-weight: 800; font-size: 1.1rem; box-shadow: 0 8px 25px rgba(0,0,0,0.5); cursor: pointer; transition: 0.2s; }
        .btn-side-punch:hover { transform: translateY(-2px); }
        .btn-side-punch.disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; filter: grayscale(1); }
        .logout-area { display: flex; align-items: center; gap: 1rem; color: #555; font-size: 0.9rem; cursor: pointer; font-weight: 600; }
        .logout-area:hover { color: white; }

        .main-layout { flex-grow: 1; display: flex; flex-direction: column; overflow-y: auto; background: #050505; }
        .top-header { padding: 1.5rem 3rem; display: flex; justify-content: space-between; align-items: center; background: rgba(5,5,5,0.8); backdrop-filter: blur(20px); position: sticky; top: 0; z-index: 50; }
        .search-bar { background: #0d0d0d; border: 1px solid #1a1a1a; padding: 0.8rem 1.2rem; border-radius: 12px; display: flex; align-items: center; gap: 0.8rem; width: 400px; }
        .search-bar input { background: transparent; border: none; color: white; font-size: 0.9rem; width: 100%; }
        .search-bar input:focus { outline: none; }
        .user-profile { display: flex; align-items: center; gap: 1.2rem; }
        .u-info { text-align: right; line-height: 1.2; }
        .u-info strong { display: block; font-size: 1.1rem; color: #eee; }
        .u-info span { font-size: 0.8rem; color: #555; font-weight: 700; }
        .u-avatar { width: 44px; height: 44px; background: #1a1a1a; border: 1px solid #333; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; color: #fff; }

        .view-content { padding: 1.5rem 2rem; }
        .system-card { background: #0a0a0a; border: 1px solid #161616; border-radius: 32px; padding: 3.5rem; margin-bottom: 3.5rem; }
        .card-row { display: flex; justify-content: space-between; align-items: flex-end; }
        .tag { font-size: 0.75rem; color: #444; font-weight: 800; letter-spacing: 2px; }
        .clock { font-size: 6rem; font-weight: 900; margin: 0.2rem 0; letter-spacing: -3px; color: #fff; line-height: 1; }
        .date { font-size: 1.4rem; color: #666; margin-bottom: 2rem; }
        .loc-pin { color: #444; font-size: 0.9rem; display: flex; align-items: center; gap: 0.6rem; }

        .punch-hero-btn { padding: 1.8rem 5rem; border-radius: 20px; border: none; background: #e61e2a; color: white; font-weight: 900; font-size: 1.5rem; cursor: pointer; box-shadow: 0 15px 45px rgba(230, 30, 42, 0.4); transition: 0.3s; }
        .punch-hero-btn:hover { transform: scale(1.05) translateY(-5px); }
        .punch-hero-btn.disabled, .m-punch-btn.disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; filter: grayscale(1); }

        .ledger-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .ledger-header h3 { font-size: 1.5rem; color: #eee; }
        .ledger-link { font-size: 0.85rem; color: #e61e2a; font-weight: 800; cursor: pointer; letter-spacing: 1px; }

        .ledger-container { background: #080808; border: 1px solid #161616; border-radius: 24px; overflow: hidden; }
        .ledger-table { border-collapse: collapse; width: 100%; text-align: left; }
        .ledger-table th { padding: 1.5rem 2.5rem; background: #0c0c0c; color: #333; font-size: 0.8rem; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 800; }
        .ledger-row { border-bottom: 1px solid #111; transition: 0.2s; }
        .ledger-row:hover { background: rgba(255,255,255,0.015); }
        .ledger-row.active-row { background: rgba(230, 30, 42, 0.05); }
        .ledger-row td { padding: 1.8rem 2.5rem; vertical-align: middle; }

        .day-details { background: #050505; }
        .detail-panel { padding: 1rem 2.5rem 3rem 2.5rem; border-bottom: 2px solid #111; }
        .session-grid { display: flex; gap: 2rem; overflow-x: auto; padding-bottom: 1rem; }
        .punch-item { min-width: 200px; background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 20px; overflow: hidden; }
        .p-photo { position: relative; height: 160px; }
        .p-photo img { width: 100%; height: 100%; object-fit: cover; }
        .p-tag { position: absolute; bottom: 10px; left: 10px; font-size: 0.6rem; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; color: #fff; }
        .p-tag.checked-in { background: #00ff0a; color: #000; }
        .p-tag.checked-out { background: #e61e2a; }
        .p-info { padding: 1.2rem; }
        .p-info strong { display: block; font-size: 1.1rem; color: #fff; margin-bottom: 0.3rem; }
        .p-info p { font-size: 0.75rem; color: #555; line-height: 1.3; }

        .in { color: #00ff0a; }
        .status-badge { background: rgba(0,255,10,0.1); color: #00ff0a; padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.75rem; font-weight: 900; }

        .verify-stack { display: flex; gap: 1rem; }
        .thumb-v { position: relative; width: 56px; height: 56px; }
        .thumb-v img { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; border: 1px solid #222; }
        .thumb-v span { position: absolute; bottom: -4px; right: -4px; background: #000; font-size: 0.6rem; font-weight: 900; padding: 2px 5px; border-radius: 4px; border: 1px solid #222; }
        .more-count { width: 32px; height: 32px; border-radius: 50%; background: #111; border: 1px solid #222; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800; color: #444; margin-left: -5px; }
        .l-loc { font-size: 0.85rem; color: #444; }

        .alert-status-box { margin-top: 2rem; padding: 1.2rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; display: flex; align-items: center; gap: 1rem; }
        .alert-indicator { position: relative; width: 32px; height: 32px; background: #111; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #444; border: 1px solid #222; }
        .alert-indicator.active { color: #00ff0a; border-color: rgba(0,255,10,0.3); }
        .alert-indicator.active .a-glow { position: absolute; inset: -4px; border: 2px solid #00ff0a; border-radius: 50%; opacity: 0; animation: a-pulse 2s infinite; }
        @keyframes a-pulse { 0% { opacity: 0.6; transform: scale(0.8); } 100% { opacity: 0; transform: scale(1.4); } }
        .a-text { display: flex; flex-direction: column; gap: 0.1rem; }
        .a-text strong { font-size: 0.75rem; color: #eee; }
        .a-text span { font-size: 0.6rem; color: #555; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }

        .capture-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(15px); }
        .modal-content { background: #0d0d0d; padding: 3rem; border-radius: 40px; border: 1px solid #222; width: 550px; text-align: center; }
        .cam-box { width: 100%; height: 400px; background: #000; border-radius: 25px; overflow: hidden; margin: 2rem 0; border: 1px solid #333; }
        .cam-box video, .cam-box img { width: 100%; height: 100%; object-fit: cover; }
        .modal-btns { display: flex; gap: 1.2rem; flex-direction: column; }
        .confirm-btn { padding: 1.4rem; background: #e61e2a; border: none; border-radius: 15px; color: white; font-weight: 800; font-size: 1.1rem; cursor: pointer; }
        .retake-btn { padding: 1.4rem; background: #1a1a1a; color: #888; border: none; border-radius: 15px; cursor: pointer; }
        .close-btn { color: #444; background: none; border: none; font-size: 1rem; margin-top: 1rem; }

        .success-overlay { position: fixed; bottom: 40px; right: 40px; z-index: 2000; }\n            @media (max-width: 768px) { .success-overlay { bottom: 100px; right: 20px; left: 20px; text-align: center; } }
        .success-toast { background: #00ff0a; color: black; padding: 1.2rem 2.5rem; border-radius: 12px; font-weight: 800; font-size: 1.1rem; }

        .attendance-view { padding: 1rem 0; }
        .cal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .cal-legend { display: flex; gap: 2rem; }
        .l-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.7rem; font-weight: 800; color: #555; text-transform: uppercase; letter-spacing: 1px; }
        .l-dot { width: 8px; height: 8px; border-radius: 50%; }
        .l-dot.p { background: #00ff0a; box-shadow: 0 0 10px rgba(0,255,10,0.5); }
        .l-dot.a { background: #1a1a1a; }

        .calendar-card { background: #0a0a0a; border: 1px solid #161616; border-radius: 32px; padding: 3rem; }
        .cal-grid-base { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1rem; }
        .cal-weekday { text-align: center; color: #333; font-weight: 900; font-size: 0.75rem; text-transform: uppercase; padding-bottom: 1.5rem; }
        .cal-day { height: 100px; }
        .cal-day-box { height: 120px; background: #0c0c0c; border: 1px solid #161616; border-radius: 16px; padding: 1rem; position: relative; transition: 0.3s; }
        .cal-day-box:hover { background: #111; border-color: #333; transform: scale(1.02); z-index: 2; }
        .cal-day-box.is-present { border-color: rgba(0,255,10,0.3); background: rgba(0,255,10,0.02); }
        .cal-day-box.is-today { border-color: #e61e2a; box-shadow: inset 0 0 20px rgba(230, 30, 42, 0.05); }
        .d-num { font-size: 1.2rem; font-weight: 900; color: #444; }
        .is-present .d-num { color: #00ff0a; }
        .is-today .d-num { color: #fff; }
        .p-indicator { position: absolute; bottom: 1rem; left: 1rem; right: 1rem; background: rgba(0,255,10,0.1); color: #00ff0a; font-size: 0.6rem; font-weight: 900; text-align: center; padding: 0.4rem; border-radius: 6px; letter-spacing: 1px; }

        .reports-view { padding: 1rem 0; }
        .reports-top { display: flex; gap: 3rem; margin-bottom: 4rem; }
        .stat-pill { background: #0a0a0a; border: 1px solid #161616; padding: 1.5rem 3rem; border-radius: 20px; display: flex; flex-direction: column; gap: 0.5rem; }
        .stat-pill span { font-size: 0.7rem; color: #444; font-weight: 800; letter-spacing: 1px; }
        .stat-pill strong { font-size: 1.8rem; color: #fff; line-height: 1; }
        .red-side { border-left: 3px solid #e61e2a; background: linear-gradient(90deg, rgba(230,30,42,0.03), transparent); }

        .reports-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 3rem; }
        .chart-card { background: #0a0a0a; border: 1px solid #161616; border-radius: 32px; padding: 3rem; position: relative; }
        .card-top { margin-bottom: 2.5rem; }
        .card-top h3 { font-size: 1.4rem; color: #eee; margin-bottom: 0.3rem; }
        .card-top p { font-size: 0.8rem; color: #444; }

        .bar-chart-v { display: flex; align-items: flex-end; justify-content: space-between; height: 240px; padding: 0 1rem; }
        .bar-wrapper { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1rem; max-width: 15px; }
        .bar-pillar { width: 100%; height: 5px; background: #1a1a1a; border-radius: 10px; transition: 1s cubic-bezier(0.17, 0.67, 0.83, 0.67); }
        .bar-pillar.filled { background: #00ff0a; box-shadow: 0 0 20px rgba(0,255,10,0.15); max-height: 200px; }
        .bar-label { font-size: 0.6rem; color: #333; font-weight: 800; }

        .heatmap-box { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.6rem; margin: 2rem 0; }\n            @media (max-width: 480px) { .heatmap-box { gap: 0.3rem; } .heat-sq { border-radius: 2px; } }
        .heat-sq { width: 100%; aspect-ratio: 1; border-radius: 4px; transition: 0.3s; }
        .heat-sq:hover { transform: scale(1.1); filter: brightness(1.2); }
        .heat-legend { font-size: 0.7rem; color: #333; text-align: center; font-weight: 700; }

        .fade-in { animation: fadeIn 0.6s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }

        .mobile-only { display: none !important; }
        .desktop-only { display: flex !important; }
        
        @media (max-width: 1280px) {
           .sidebar { width: 100px; padding: 1.5rem 0.5rem; align-items: center; }
           .logo-text, .nav-link span:not(.icon), .u-info, .search-bar { display: none; }
           .main-layout { width: calc(100vw - 100px); }
           .clock { font-size: 3rem; }
        }

        @media (max-width: 768px) {
           .desktop-only { display: none !important; }
           .mobile-only { display: block !important; }

           .mobile-header { position: sticky; top: 0; z-index: 1001; display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.5rem; background: rgba(0,0,0,0.8); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.05); width: 100%; top: 0; }
           .m-h-brand { display: flex; align-items: center; gap: 0.8rem; }
           .m-h-brand span { font-weight: 700; font-size: 0.95rem; color: #eee; letter-spacing: -0.5px; }
           .m-logout-btn { background: rgba(230, 30, 42, 0.1); border: 1px solid rgba(230, 30, 42, 0.2); color: #e61e2a; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; cursor: pointer; }
           .m-logout-btn:active { transform: scale(0.9); background: #e61e2a; color: #fff; }
           
           .app-container { flex-direction: column; height: auto; }
           .main-layout { width: 100%; min-height: 100vh; padding-bottom: 80px; }
           .view-content { padding: 1.5rem; }
           
           /* Bottom Nav Bar */
           .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(5,5,5,0.95); backdrop-filter: blur(20px); border-top: 1px solid #1a1a1a; display: flex !important; justify-content: space-around; padding: 0.8rem 0; z-index: 1000; box-shadow: 0 -10px 40px rgba(0,0,0,0.5); }
           .nav-item { background: none; border: none; color: #444; display: flex; flex-direction: column; align-items: center; gap: 0.3rem; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; width: 25%; }
           .nav-item.active { color: #e61e2a; pointer-events: none; }

           /* Mobile Hero Box */
           .mobile-hero-box { background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%); border: 1px solid #222; border-radius: 24px; padding: 2rem; margin-bottom: 2rem; position: relative; overflow: hidden; }
           .m-time-display { text-align: center; margin-bottom: 1.5rem; }
           .m-label { font-size: 0.6rem; color: #444; font-weight: 900; letter-spacing: 2px; }
           .m-clock { font-size: 3.5rem; font-weight: 950; color: #fff; line-height: 1; margin: 0.5rem 0; }
           .m-date { font-size: 0.9rem; color: #666; font-weight: 700; }
           .m-loc-info { font-size: 0.75rem; color: #444; text-align: center; margin-bottom: 2rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
           
           .m-punch-btn { width: 100%; height: 120px; background: #e61e2a; border: none; border-radius: 18px; position: relative; overflow: hidden; cursor: pointer; color: #fff; box-shadow: 0 10px 30px rgba(230,30,42,0.3); }
           .m-punch-btn.punched { background: #00ff0a; box-shadow: 0 10px 30px rgba(0,255,10,0.3); }
           .m-p-ripple { position: absolute; inset: 0; background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%); opacity: 0; animation: m-ripple 2s infinite; }
           @keyframes m-ripple { 0%, 100% { transform: scale(0.8); opacity: 0; } 50% { transform: scale(1.2); opacity: 0.6; } }
           .m-p-content { postion: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.6rem; z-index: 2; height: 100%; }
           .m-p-content span { font-size: 1.25rem; font-weight: 900; letter-spacing: 1px; }

           /* Mobile Log Stack */
           .m-logs-stack { display: flex; flex-direction: column; gap: 1rem; }
           .m-log-tile { background: #0a0a0a; border: 1px solid #1a1a1a; padding: 1.2rem; border-radius: 16px; display: flex; flex-direction: column; gap: 1rem; position: relative; }
           .tile-date { font-size: 0.8rem; color: #444; font-weight: 800; display: flex; align-items: center; gap: 0.5rem; }
           .tile-hours { display: flex; align-items: center; gap: 1.5rem; }
           .h-box { flex: 1; }
           .h-box small { display: block; font-size: 0.6rem; color: #333; text-transform: uppercase; font-weight: 900; margin-bottom: 0.2rem; }
           .h-box strong { font-size: 1.1rem; color: #fff; }
           .h-box.in strong { color: #00ff0a; }
           .h-div { color: #222; font-size: 1.2rem; }
           .m-verify-tag { position: absolute; top: 1.2rem; right: 1.2rem; display: flex; align-items: center; gap: 0.4rem; color: #00ff0a; font-size: 0.65rem; font-weight: 900; background: rgba(0,255,10,0.05); padding: 0.3rem 0.6rem; border-radius: 6px; }
           .pulse-dot { width: 5px; height: 5px; background: #00ff0a; border-radius: 50%; box-shadow: 0 0 10px #00ff0a; animation: p-dot 2s infinite; }
           @keyframes p-dot { 0%, 100% { opacity: 1; box-shadow: 0 0 10px #00ff0a; } 50% { opacity: 0.4; box-shadow: 0 0 2px #00ff0a; } }

           /* Reports Mobile */
           .reports-top { flex-direction: column; gap: 0.8rem; margin-bottom: 2rem; }\n            .stat-pill strong { font-size: 1.4rem; }
           .stat-pill { padding: 1rem 1.5rem; flex-direction: row; justify-content: space-between; align-items: center; }
           .reports-grid { grid-template-columns: 1fr; gap: 2rem; }
           .chart-card { padding: 1.5rem; border-radius: 20px; }
           .bar-chart-v { height: 160px; overflow-x: auto; padding-bottom: 20px; display: flex; gap: 8px; justify-content: flex-start; scrollbar-width: none; }\n            .bar-chart-v::-webkit-scrollbar { display: none; }\n            .bar-wrapper { min-width: 12px; }

           /* Calendar Mobile */
           .cal-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
           .calendar-card { padding: 1.5rem; border-radius: 20px; }
           .cal-grid-base { gap: 4px; }
           .cal-day-box { height: 60px; padding: 0.4rem; border-radius: 12px; }
           .p-indicator { font-size: 0.35rem; bottom: 0.4rem; left: 0.1rem; right: 0.1rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; padding: 2px; }
           .d-num { font-size: 0.9rem; }

           /* Leave View Mobile */
           .leave-view-mobile { animation: fadeIn 0.5s ease; }
           .mobile-only-leave-header { text-align: center; margin-bottom: 3rem; }
           .mobile-only-leave-header h2 { font-size: 2rem; font-weight: 950; margin-bottom: 0.5rem; }
           .mobile-only-leave-header p { font-size: 0.9rem; color: #555; line-height: 1.5; }
           .apply-leave-btn-hero { width: 100%; background: linear-gradient(135deg, #e61e2a 0%, #a8121a 100%); border: none; padding: 3rem; border-radius: 24px; color: #fff; display: flex; flex-direction: column; align-items: center; gap: 1.5rem; cursor: pointer; box-shadow: 0 15px 50px rgba(230,30,42,0.4); }
           .apply-leave-btn-hero span { font-size: 1.5rem; font-weight: 950; letter-spacing: 1px; }

           /* Modal Mobile */
           .modal-content { width: 90vw; padding: 2rem; border-radius: 30px; }
           .cam-box { height: 300px; }
        }
      `}</style>
    </div>
  );
}
