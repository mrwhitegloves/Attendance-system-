"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  Users, 
  Calendar, 
  FileText, 
  Shield, 
  Search, 
  MoreVertical, 
  Download, 
  CheckCircle, 
  XCircle,
  MapPin,
  Clock,
  ArrowRight,
  UserCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';

interface User {
  _id: string;
  name: string;
  employeeId: string;
  email: string;
  department: string;
  staffType: string;
  createdAt: string;
}

interface AttendanceRecord {
  _id: string;
  employeeId: string;
  userName: string;
  department: string;
  date: string;
  lastPunch: string;
  location: string;
  lat: number;
  lon: number;
  remark: string;
  selfie: string;
  history: any[];
  status: string;
  time: string;
}

export default function AdminDashboard({ profile }: { profile: any }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'employees' | 'attendance' | 'leaves' | 'insights'>('overview');
  const [employees, setEmployees] = useState<User[]>([]);
  const [logs, setLogs] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  
  // Specific for Insights Tab
  const [selectedUserForInsight, setSelectedUserForInsight] = useState<string | null>(null);
  const [currentInsightMonth, setCurrentInsightMonth] = useState(new Date().getMonth());
  const [currentInsightYear, setCurrentInsightYear] = useState(new Date().getFullYear());
  const [userLogsForInsight, setUserLogsForInsight] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'insights' && selectedUserForInsight) {
       fetchUserSpecificLogs();
    }
  }, [activeTab, selectedUserForInsight, currentInsightMonth, currentInsightYear]);

  const fetchUserSpecificLogs = async () => {
     try {
       const res = await fetch(`/api/admin/attendance?employeeId=${selectedUserForInsight}&date=${currentInsightYear}-${String(currentInsightMonth + 1).padStart(2, '0')}`);
       const result = await res.json();
       setUserLogsForInsight(result);
     } catch (err) { console.error(err); }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
       if (activeTab === 'overview' || activeTab === 'employees') {
          const res = await fetch('/api/admin/employees');
          const data = await res.json();
          setEmployees(data);
       }
       if (activeTab === 'overview' || activeTab === 'attendance') {
          const res = await fetch('/api/admin/attendance');
          const data = await res.json();
          setLogs(data);
       }
    } catch (err) {
       console.error("Fetch failed", err);
    } finally {
       setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.reload();
  };

  const exportDailyAttendance = () => {
    if (logs.length === 0) return alert("No logs available to export today.");
    const headers = ['Employee Name', 'Employee ID', 'Department', 'Date', 'Time', 'Status', 'Location'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log => [
        `"${log.userName}"`,
        `"${log.employeeId}"`,
        `"${log.department}"`,
        `"${log.date}"`,
        `"${log.time}"`,
        `"${log.status}"`,
        `"${log.location.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Daily_Attendance_${new Date().toLocaleDateString('en-CA')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLogs = logs.filter(log => 
    log.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-container fade-in">
      <div className="bg-vfx-container">
        <div className="vfx-circle v1"></div>
        <div className="vfx-circle v2"></div>
        <div className="vfx-dots"></div>
      </div>
      <aside className="admin-sidebar">
        <div className="brand-header">
           <div className="logo">
              <Image src="/logo.png" alt="MWG" width={32} height={32} style={{borderRadius:'4px'}} />
              <span>Admin</span>
           </div>
           <p>Workforce IQ</p>
        </div>

        <nav className="nav-menu">
          <div className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            <Shield size={20} /> Dashboard
          </div>
          <div className={`nav-item ${activeTab === 'employees' ? 'active' : ''}`} onClick={() => setActiveTab('employees')}>
            <Users size={20} /> All Employees
          </div>
          <div className={`nav-item ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>
            <Clock size={20} /> Shift Logs
          </div>
          <div className={`nav-item ${activeTab === 'leaves' ? 'active' : ''}`} onClick={() => setActiveTab('leaves')}>
            <FileText size={20} /> Leave Requests
          </div>
          <div className={`nav-item ${activeTab === 'insights' ? 'active' : ''}`} onClick={() => setActiveTab('insights')}>
            <Calendar size={20} /> Presence Analysis
          </div>
        </nav>

        <div className="sidebar-footer">
           <button className="logout-btn" onClick={handleLogout}>
             <LogOut size={20} />
             <span>Logout</span>
           </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div className="header-info">
            <h1>Command Center</h1>
            <p>Admin Control Panel for White Gloves Technologies</p>
          </div>
          <div className="search-bar">
             <Search size={18} />
             <input 
               type="text" 
               placeholder="Search Employee ID or Name..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
        </header>

        {activeTab === 'overview' && (
          <div className="tab-view panel">
            <div className="stats-row grid-3">
              <div className="stat-card premium-card">
                 <div className="icon-badge"><Users size={24} /></div>
                 <div className="v-stack">
                    <span className="label">Total Workforce</span>
                    <strong className="value">{employees.length}</strong>
                 </div>
              </div>
              <div className="stat-card premium-card">
                 <div className="icon-badge"><UserCheck size={24} /></div>
                 <div className="v-stack">
                    <span className="label">Active Today</span>
                    <strong className="value">{logs.length}</strong>
                 </div>
              </div>
              <div className="stat-card premium-card">
                 <div className="icon-badge"><FileText size={24} /></div>
                 <div className="v-stack">
                    <span className="label">Pending Requests</span>
                    <strong className="value">0</strong>
                 </div>
              </div>
            </div>

            <div className="status-board card-vfx">
               <h3>Live Workforce Status Board</h3>
               <div className="status-grid">
                  {(() => {
                     const todayStr = new Date().toLocaleDateString('en-CA');
                     // Filter for today's logs
                     const todayLogs = logs.filter(l => l.date === todayStr);
                     
                     // Group into sessions: { employeeId: { inTime, outTime, selfie, ... } }
                     const sessionsMap = new Map();
                     todayLogs.forEach(log => {
                        if (!sessionsMap.has(log.employeeId)) {
                           sessionsMap.set(log.employeeId, { ...log, inTime: '--', outTime: '--', inSelfie: null });
                        }
                        const s = sessionsMap.get(log.employeeId);
                        if (log.status === 'Checked In') {
                           s.inTime = log.time;
                           s.inSelfie = log.selfie;
                        } else {
                           s.outTime = log.time;
                           s.outSelfie = log.selfie;
                        }
                     });

                     const displaySessions = Array.from(sessionsMap.values());

                     return displaySessions.length > 0 ? displaySessions.map((session) => (
                        <div key={session._id} className="status-tile" onClick={() => { setActiveTab('attendance'); setExpandedLog(session._id); }}>
                           <div className="tile-top">
                              {session.inSelfie ? <img src={session.inSelfie} className="tile-img" alt="S" /> : <div className="no-img">No Img</div>}
                              <div className="tile-badge">IN</div>
                           </div>
                           <div className="tile-info">
                              <strong>{session.userName}</strong>
                              <p>{session.department}</p>
                              <div className="tile-time"><Clock size={12} /> {session.inTime}</div>
                           </div>
                        </div>
                     )) : <p className="empty-msg">No team activity recorded today.</p>;
                  })()}
               </div>
            </div>

            <div className="main-content-split">
               <div className="wide-panel logs-recent card-vfx">
                  <h3>Today's Attendance Ledger</h3>
                  <div className="mini-ledger-wrapper">
                    <table className="mini-ledger-table">
                      <thead>
                        <tr>
                          <th>EMPLOYEE</th>
                          <th>PUNCH IN & SELFIE</th>
                          <th>PUNCH OUT</th>
                          <th>LOCATION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                           const todayStr = new Date().toLocaleDateString('en-CA');
                           const todayLogs = logs.filter(l => l.date === todayStr);

                           // Simple grouping for the ledger
                           const finalSessions = new Map();
                           todayLogs.forEach(l => {
                              if (!finalSessions.has(l.employeeId)) {
                                 finalSessions.set(l.employeeId, { ...l, inTime: '--', outTime: '--' });
                              }
                              const s = finalSessions.get(l.employeeId);
                              if (l.status === 'Checked In') s.inTime = l.time;
                              else s.outTime = l.time;
                           });

                           const rowData = Array.from(finalSessions.values());

                           if (rowData.length === 0) return (
                              <tr><td colSpan={4} className="empty-msg">No team activity recorded today.</td></tr>
                           );

                           return rowData.map((session) => {
                              const isExpanded = expandedLog === session._id;
                              return (
                                 <React.Fragment key={session._id}>
                                    <tr className={`mini-row ${isExpanded ? 'expanded' : ''}`} onClick={() => setExpandedLog(isExpanded ? null : session._id)}>
                                       <td>
                                          <div className="user-cell">
                                             <strong>{session.userName}</strong>
                                             <small>{session.department}</small>
                                          </div>
                                       </td>
                                       <td className="t-cell">
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                             {session.selfie && <img src={session.selfie} className="thumb" alt="S" />}
                                             <span>{session.inTime}</span>
                                          </div>
                                       </td>
                                       <td className="t-cell out">
                                          {session.outTime === '--' && session.inTime !== '--' && <div className="live-dot" />} 
                                          {session.outTime !== '--' ? session.outTime : (session.inTime !== '--' ? 'ACTIVE' : '--')}
                                       </td>
                                       <td className="l-cell">
                                          📍 {session.location ? (session.location.substring(0, 30) + '...') : '--'}
                                       </td>
                                    </tr>
                                    {isExpanded && (
                                       <tr className="mini-detail-row">
                                          <td colSpan={4}>
                                             <div className="mini-detail-content">
                                                <div className="detail-top">
                                                   <div className="d-pane text">
                                                      <label>Full Address</label>
                                                      <p>{session.location}</p>
                                                      <label>Verification Marks</label>
                                                      <div style={{ display: 'flex', gap: '10px' }}>
                                                         {session.selfie && <img src={session.selfie} style={{ width: '80px', borderRadius: '8px' }} />}
                                                         {session.outSelfie && <img src={session.outSelfie} style={{ width: '80px', borderRadius: '8px' }} />}
                                                      </div>
                                                   </div>
                                                   <div className="d-pane map">
                                                      {session.lat && session.lon ? (
                                                         <iframe 
                                                            width="100%" 
                                                            height="120" 
                                                            frameBorder="0" 
                                                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${session.lon-0.01}%2C${session.lat-0.01}%2C${session.lon+0.01}%2C${session.lat+0.01}&layer=mapnik&marker=${session.lat}%2C${session.lon}`}
                                                         />
                                                      ) : <p>Map data unavailable</p>}
                                                   </div>
                                                </div>
                                             </div>
                                          </td>
                                       </tr>
                                    )}
                                 </React.Fragment>
                              );
                           });
                        })()}
                      </tbody>
                    </table>
                  </div>
               </div>
               
               <aside className="side-panel quick-links">
                  <h3>Management Tools</h3>
                  <div className="q-link" onClick={exportDailyAttendance}>
                     <Download size={18} /> Export Daily Attendance
                  </div>
                  <div className="q-link" onClick={() => setActiveTab('employees')}>
                     <Users size={18} /> Workforce Auditing
                  </div>
                  <div className="q-link">
                     <Shield size={18} /> Access Controls
                  </div>
               </aside>
            </div>
          </div>
        )}

        {activeTab === 'employees' && (
           <div className="tab-view panel">
              <div className="table-header-row">
                 <h2>Employee Directory</h2>
              </div>
              <div className="emp-grid">
                 {filteredEmployees.map((emp, i) => (
                    <div key={i} className="emp-card card-vfx">
                       <div className="emp-top">
                          <div className="emp-avatar">{emp.name.charAt(0)}</div>
                          <div className="emp-name-stack">
                             <h4>{emp.name}</h4>
                             <p>{emp.employeeId}</p>
                          </div>
                       </div>
                       <div className="emp-details">
                          <div className="d-item"><span>Dept:</span> {emp.department}</div>
                          <div className="d-item"><span>Joined:</span> {new Date(emp.createdAt).toLocaleDateString()}</div>
                          <div className="d-item"><span>Staff:</span> {emp.staffType}</div>
                       </div>
                       <button className="p-btn" onClick={() => { setSearchTerm(emp.employeeId); setActiveTab('attendance'); }}>View History</button>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'attendance' && (
           <div className="tab-view panel">
              <div className="table-header-row">
                 <h2>Shift Attendance Ledger</h2>
                 <button className="export-mini-btn" onClick={() => window.print()}><Download size={16} /> Print View</button>
              </div>
              
              <div className="ledger-wrapper">
                 <table className="ledger-table">
                    <thead>
                       <tr>
                          <th>EMPLOYEE</th>
                          <th>LAST PUNCH</th>
                          <th>LOCATION</th>
                          <th>STATUS</th>
                          <th>ACTIONS</th>
                       </tr>
                    </thead>
                    <tbody>
                       {filteredLogs.map((log, i) => (
                          <React.Fragment key={i}>
                             <tr className={expandedLog === log._id ? 'expanded' : ''}>
                                <td>
                                   <div className="user-info-cell">
                                      <strong>{log.userName}</strong>
                                      <small>{log.employeeId}</small>
                                   </div>
                                </td>
                                <td>{log.lastPunch}</td>
                                <td>{log.location.substring(0, 30)}...</td>
                                <td><span className="badge-active">Online</span></td>
                                <td>
                                   <button className="action-circle-btn" onClick={() => setExpandedLog(expandedLog === log._id ? null : log._id)}>
                                      <MoreVertical size={16} />
                                   </button>
                                </td>
                             </tr>
                             {expandedLog === log._id && (
                                <tr className="detail-row">
                                   <td colSpan={5}>
                                      <div className="log-detail-expanded">
                                         <div className="detail-split">
                                            <div className="selfie-view">
                                               {log.selfie && <img src={log.selfie} alt="Verification" />}
                                            </div>
                                            <div className="map-view">
                                               <iframe 
                                                 width="100%" 
                                                 height="200" 
                                                 frameBorder="0" 
                                                 scrolling="no" 
                                                 src={`https://www.openstreetmap.org/export/embed.html?bbox=${log.lon-0.01}%2C${log.lat-0.01}%2C${log.lon+0.01}%2C${log.lat+0.01}&layer=mapnik&marker=${log.lat}%2C${log.lon}`}
                                               />
                                            </div>
                                            <div className="meta-view">
                                               <h4>Session Details</h4>
                                               <p><strong>Employee:</strong> {log.userName}</p>
                                               <p><strong>Remark:</strong> {log.remark || 'N/A'}</p>
                                               <p><strong>Full Location:</strong> {log.location}</p>
                                               <div className="log-history">
                                                  <h5>Punch History</h5>
                                                  {log.history?.map((h, j) => (
                                                     <div key={j} className="h-item">
                                                        <span>{h.status}: {h.time}</span>
                                                     </div>
                                                  ))}
                                               </div>
                                            </div>
                                         </div>
                                      </div>
                                   </td>
                                </tr>
                             )}
                          </React.Fragment>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeTab === 'leaves' && (
           <div className="tab-view panel">
              <div className="table-header-row">
                 <h2>Management Oversight: Leaves</h2>
              </div>
              <div className="hq-notice-card">
                 <div className="hq-icon"><FileText size={32} /></div>
                 <div className="hq-text">
                    <h3>Franchise HR Routing</h3>
                    <p>All formal leave applications are currently routed to the central management hub for verification.</p>
                    <div className="hq-email-box">
                       <strong>franchise@mrwhitegloves.com</strong>
                       <button onClick={() => window.open('mailto:franchise@mrwhitegloves.com')}>Message HR</button>
                    </div>
                 </div>
              </div>
           </div>
        )}
         {activeTab === 'insights' && (
            <div className="tab-view panel">
               <div className="table-header-row">
                  <h2>Presence Analysis: {new Date(currentInsightYear, currentInsightMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                  <div className="insight-controls">
                     <select 
                       className="i-select"
                       value={selectedUserForInsight || ''} 
                       onChange={(e) => setSelectedUserForInsight(e.target.value)}
                     >
                        <option value="">Select Employee</option>
                        {employees.map(e => <option key={e.employeeId} value={e.employeeId}>{e.name} ({e.employeeId})</option>)}
                     </select>
                     <div className="cal-nav-btns">
                        <button onClick={() => {
                           if (currentInsightMonth === 0) { setCurrentInsightMonth(11); setCurrentInsightYear(prev => prev - 1); }
                           else setCurrentInsightMonth(prev => prev - 1);
                        }}><ChevronLeft size={16} /></button>
                        <button onClick={() => {
                           if (currentInsightMonth === 11) { setCurrentInsightMonth(0); setCurrentInsightYear(prev=>prev+1); }
                           else setCurrentInsightMonth(prev=>prev+1);
                        }}><ChevronRight size={16} /></button>
                     </div>
                  </div>
               </div>

               {!selectedUserForInsight ? (
                  <div className="hq-notice-card">
                     <div className="hq-icon"><Filter size={32} /></div>
                     <div className="hq-text">
                        <h3>Employee Analysis Required</h3>
                        <p>To view detailed presence reports, please select an employee from the dropdown above. The system will display their presence/absence calendar for the selected month.</p>
                     </div>
                  </div>
               ) : (
                  <div className="insight-grid">
                     <div className="mini-stats-row">
                        <div className="premium-min-card">
                           <span>DAYS PRESENT (This Month)</span>
                           <strong>{[...new Set(userLogsForInsight.map(l => l.date))].length}</strong>
                        </div>
                        <div className="premium-min-card highlight">
                           <span>STATUS SUMMARY</span>
                           <strong>ACTIVE</strong>
                        </div>
                     </div>

                     <div className="card-vfx presence-calendar">
                        <div className="p-cal-grid">
                           {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="p-cal-day-name">{d}</div>)}
                           {(() => {
                              const firstDay = new Date(currentInsightYear, currentInsightMonth, 1).getDay();
                              const daysCount = new Date(currentInsightYear, currentInsightMonth + 1, 0).getDate();
                              const presentDates = new Set(userLogsForInsight.map(l => l.date));
                              const items = [];
                              for (let i = 0; i < firstDay; i++) items.push(<div key={`empty-${i}`} className="p-cal-day empty"></div>);
                              for (let d = 1; d <= daysCount; d++) {
                                 const dStr = `${currentInsightYear}-${String(currentInsightMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                 const isPresent = presentDates.has(dStr);
                                 items.push(
                                    <div key={d} className={`p-cal-day ${isPresent ? 'present' : ''}`}>
                                       <span>{d}</span>
                                       {isPresent && <div className="p-marker" title="Present"></div>}
                                    </div>
                                 );
                              }
                              return items;
                           })()}
                        </div>
                     </div>
                  </div>
               )}
            </div>
         )}
      </main>

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
          opacity: 0.15;
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

        .admin-container {
          display: flex;
          min-height: 100vh;
          background: #000;
          color: #fff;
          font-family: 'Inter', sans-serif;
          position: relative;
        }

        .admin-sidebar, .admin-main {
          position: relative;
          z-index: 10;
        }

        .admin-sidebar {
          width: 280px;
          background: #080808;
          border-right: 1px solid #1a1a1a;
          display: flex;
          flex-direction: column;
          padding: 2.5rem 1.5rem;
          position: sticky;
          top: 0;
          height: 100vh;
        }

        .brand-header {
           margin-bottom: 3.5rem;
           text-align: center;
        }

        .logo { 
           font-size: 1.8rem; 
           font-weight: 900; 
           letter-spacing: -1px; 
           font-family: 'Outfit', sans-serif;
        }
        .logo span { color: var(--primary); }
        .brand-header p { 
           font-size: 0.7rem; 
           color: #555; 
           text-transform: uppercase; 
           letter-spacing: 3px; 
           margin-top: 0.3rem;
           font-weight: 700;
        }

        .nav-menu {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          flex-grow: 1;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.2rem;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s;
          color: #888;
          font-weight: 600;
          font-size: 0.95rem;
        }

        .nav-item:hover {
          background: rgba(255, 255, 255, 0.03);
          color: #fff;
        }

        .nav-item.active {
          background: var(--primary);
          color: #fff;
          box-shadow: 0 5px 15px rgba(230, 30, 42, 0.2);
        }

        .logout-btn {
           background: transparent;
           border: 1px solid #333;
           color: #888;
           width: 100%;
           padding: 0.8rem;
           border-radius: 10px;
           font-weight: 600;
           display: flex;
           align-items: center;
           justify-content: center;
           gap: 0.8rem;
           transition: all 0.3s;
        }

        .logout-btn:hover {
           background: #e61e2a;
           color: #fff;
           border-color: #e61e2a;
        }

        .admin-main {
          flex-grow: 1;
          padding: 3rem;
          max-width: calc(100vw - 280px);
        }

        .admin-header {
           display: flex;
           justify-content: space-between;
           align-items: center;
           margin-bottom: 3rem;
        }

        .admin-header h1 { font-size: 2rem; font-weight: 800; letter-spacing: -0.5px; }
        .admin-header p { color: #555; font-size: 0.9rem; }

        .search-bar {
           background: #111;
           border: 1px solid #222;
           padding: 0.7rem 1.2rem;
           border-radius: 12px;
           display: flex;
           align-items: center;
           gap: 0.8rem;
           min-width: 350px;
        }

        .search-bar input {
           background: transparent;
           border: none;
           color: #fff;
           font-size: 0.9rem;
           width: 100%;
        }

        .search-bar input:focus { outline: none; }

        .stat-card.premium-card {
           display: flex;
           align-items: center;
           gap: 1.5rem;
           padding: 2rem;
           background: #0a0a0a;
           border: 1px solid #1a1a1a;
           border-radius: 20px;
           transition: transform 0.3s;
        }

        .stat-card:hover { transform: translateY(-5px); border-color: rgba(230, 30, 42, 0.3); }

        .icon-badge {
           width: 60px;
           height: 60px;
           background: rgba(230, 30, 42, 0.1);
           color: #e61e2a;
           display: flex;
           align-items: center;
           justify-content: center;
           border-radius: 16px;
        }

        .v-stack { display: flex; flex-direction: column; }
        .v-stack .label { font-size: 0.75rem; color: #555; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
        .v-stack .value { font-size: 1.8rem; font-weight: 800; color: #fff; }

        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2.5rem; }

        .main-content-split { display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; }

        .card-vfx {
           background: #0a0a0a;
           border: 1px solid #1a1a1a;
           border-radius: 20px;
           padding: 2rem;
        }

        h3 { margin-bottom: 1.5rem; font-size: 1.1rem; font-weight: 700; }

        .activity-list { display: flex; flex-direction: column; gap: 1rem; }

        .activity-item {
           display: flex;
           align-items: center;
           gap: 1.2rem;
           background: rgba(255, 255, 255, 0.02);
           padding: 1rem 1.5rem;
           border-radius: 16px;
           border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .avatar-letter {
           width: 40px;
           height: 40px;
           background: #e61e2a;
           border-radius: 50%;
           display: flex;
           align-items: center;
           justify-content: center;
           font-weight: 800;
           font-size: 1.1rem;
        }

        .activity-item .info { flex-grow: 1; display: flex; flex-direction: column; }
        .activity-item .info strong { font-size: 0.95rem; }
        .activity-item .info span { font-size: 0.75rem; color: #666; }

        .activity-item .time, .loc { font-size: 0.8rem; color: #555; display: flex; align-items: center; gap: 0.4rem; min-width: 100px; }

        .view-detail-btn {
           background: #222;
           color: #fff;
           font-size: 0.7rem;
           padding: 0.4rem 0.8rem;
           border-radius: 8px;
        }

        .quick-links { display: flex; flex-direction: column; gap: 1rem; }
        .q-link {
           padding: 1.2rem;
           background: rgba(255, 255, 255, 0.02);
           border: 1px solid #222;
           border-radius: 15px;
           display: flex;
           align-items: center;
           gap: 1rem;
           font-size: 0.9rem;
           font-weight: 600;
           cursor: pointer;
           transition: 0.2s;
        }
        .q-link:hover { background: rgba(230, 30, 42, 0.1); border-color: rgba(230, 30, 42, 0.3); color: #e61e2a; }

        /* All Employees */
        .emp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
        .emp-card { padding: 1.5rem; }
        .emp-top { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
        .emp-avatar { width: 50px; height: 50px; background: #333; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; }
        .emp-name-stack h4 { font-size: 1.1rem; margin-bottom: 0.2rem; }
        .emp-name-stack p { font-size: 0.75rem; color: #e61e2a; letter-spacing: 1px; font-weight: 700; }

        .emp-details { display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.85rem; margin-bottom: 1.5rem; }
        .emp-details .d-item span { color: #555; margin-right: 0.5rem; }
        
        .p-btn { width: 100%; padding: 0.8rem; background: #1a1a1a; border: 1px solid #222; border-radius: 10px; font-size: 0.85rem; font-weight: 700; transition: 0.2s; }
        .p-btn:hover { background: #e61e2a; border-color: #e61e2a; }

        /* Table Style */
        .ledger-wrapper { background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 20px; overflow: hidden; }
        .ledger-table { width: 100%; border-collapse: collapse; text-align: left; }
        .ledger-table th { padding: 1.2rem; background: #111; color: #555; font-size: 0.7rem; letter-spacing: 1.5px; text-transform: uppercase; }
        .ledger-table td { padding: 1.2rem; border-bottom: 1px solid #111; font-size: 0.9rem; }
        
        .user-info-cell { display: flex; flex-direction: column; }
        .user-info-cell small { color: #555; font-size: 0.75rem; }
        
        .badge-active { background: rgba(0, 255, 10, 0.1); color: #00ff0a; padding: 0.3rem 0.7rem; border-radius: 50px; font-size: 0.75rem; font-weight: 700; }

        .action-circle-btn { width: 32px; height: 32px; background: #1a1a1a; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #888; }
        .action-circle-btn:hover { background: #333; color: #fff; }

        .detail-row td { background: #050505; border-bottom: 2px solid #e61e2a; }
        .log-detail-expanded { padding: 2rem; }
        .detail-split { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 2rem; }
        
        .selfie-view img { width: 100%; border-radius: 15px; border: 2px solid #222; }
        .map-view { border-radius: 15px; overflow: hidden; border: 1px solid #222; }
        
        .meta-view h4 { margin-bottom: 1rem; color: #e61e2a; font-family: 'Outfit'; }
        .meta-view p { font-size: 0.85rem; margin-bottom: 0.6rem; color: #888; }
        .log-history { margin-top: 2rem; }
        .log-history h5 { font-size: 0.8rem; color: #fff; margin-bottom: 0.8rem; border-bottom: 1px solid #222; padding-bottom: 0.5rem; }
        .h-item { font-size: 0.75rem; color: #555; margin-bottom: 0.4rem; }

        .status-board { margin-bottom: 2rem; }
        .status-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1.2rem; }
        .status-tile { background: #080808; border: 1px solid #1a1a1a; padding: 1rem; border-radius: 16px; cursor: pointer; transition: transform 0.3s, border-color 0.3s; position: relative; overflow: hidden; }
        .status-tile:hover { transform: scale(1.03); border-color: #e61e2a; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        
        .hq-notice-card { background: #0a0a0a; border: 1px solid #1a1a1a; padding: 3rem; border-radius: 24px; display: flex; gap: 2rem; align-items: center; max-width: 700px; margin: 4rem auto; }
        .hq-icon { width: 80px; height: 80px; background: rgba(230,30,42,0.1); color: #e61e2a; border-radius: 16px; display: flex; align-items: center; justify-content: center; }
        .hq-text h3 { margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #fff; }
        .hq-text p { color: #555; font-size: 0.95rem; margin-bottom: 2rem; max-width: 400px; }
        .hq-email-box { background: #050505; border: 1px solid #1a1a1a; padding: 1rem 1.5rem; border-radius: 12px; display: flex; align-items: center; gap: 2rem; }
        .hq-email-box strong { color: #e61e2a; font-family: 'Outfit'; font-size: 1.1rem; }
        .hq-email-box button { background: #e61e2a; border: none; color: #fff; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 800; cursor: pointer; }

        .tile-top { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; margin-bottom: 0.8rem; border: 1px solid #222; }
        .tile-img { width: 100%; height: 100%; object-fit: cover; }
        .no-img { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #111; color: #333; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; }
        .tile-badge { position: absolute; top: 0.5rem; right: 0.5rem; background: #e61e2a; color: #fff; font-size: 0.6rem; font-weight: 900; padding: 0.2rem 0.5rem; border-radius: 4px; box-shadow: 0 4px 10px rgba(230,30,42,0.5); }
        
        .tile-info strong { display: block; font-size: 0.95rem; margin-bottom: 0.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tile-info p { font-size: 0.75rem; color: #555; margin-bottom: 0.5rem; }
        .tile-time { font-size: 0.75rem; font-weight: 700; color: #e61e2a; display: flex; align-items: center; gap: 0.3rem;}

        .mini-ledger-wrapper { overflow: hidden; border-radius: 12px; border: 1px solid #1a1a1a; background: #050505; }
        .mini-ledger-table { width: 100%; border-collapse: collapse; text-align: left; }
        .mini-ledger-table th { padding: 0.8rem 1.2rem; background: #111; color: #444; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; }
        .mini-row { cursor: pointer; transition: 0.2s; border-bottom: 1px solid #111; }
        .mini-row:hover { background: rgba(255, 255, 255, 0.02); }
        .mini-row.expanded { background: rgba(230, 30, 42, 0.05); }
        .mini-row td { padding: 0.9rem 1.2rem; font-size: 0.85rem; }
        
        .user-cell { display: flex; flex-direction: column; }
        .user-cell strong { font-size: 0.9rem; }
        .user-cell small { font-size: 0.7rem; color: #555; }
        
        .t-cell { font-family: 'Outfit'; font-weight: 600; color: #fff; }
        .t-cell.out { color: #555; }
        .live-dot { width: 8px; height: 8px; background: #00ff0a; border-radius: 50%; display: inline-block; box-shadow: 0 0 10px #00ff0a; animation: pulse 1.5s infinite; }
        
        @keyframes pulse {
           0% { transform: scale(1); opacity: 1; }
           50% { transform: scale(1.5); opacity: 0.5; }
           100% { transform: scale(1); opacity: 1; }
        }

        .thumb { width: 30px; height: 30px; border-radius: 6px; object-fit: cover; border: 1px solid #333; }
        .l-cell { color: #555; font-size: 0.75rem; }

        .mini-detail-row td { padding: 0 !important; }
        .mini-detail-content { padding: 1.5rem; background: #0a0a0a; border-bottom: 2px solid #e61e2a; animation: fadeIn 0.3s ease; }
        .detail-top { display: grid; grid-template-columns: 1fr 1.5fr; gap: 1.5rem; }
        .d-pane.map { border-radius: 10px; overflow: hidden; border: 1px solid #222; }
        .d-pane.text label { display: block; font-size: 0.65rem; color: #e61e2a; font-weight: 800; text-transform: uppercase; margin-bottom: 0.3rem; }
        .d-pane.text p { font-size: 0.8rem; color: #999; margin-bottom: 1rem; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .empty-msg { padding: 3rem !important; text-align: center; color: #333; font-size: 0.9rem; }

        .panel { animation: slideUp 0.5s ease-out; }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .insight-controls { display: flex; gap: 1rem; align-items: center; }
        .i-select { background: #111; border: 1px solid #222; color: #fff; padding: 0.6rem 1rem; border-radius: 8px; font-weight: 600; outline: none; min-width: 200px; }
        .cal-nav-btns { display: flex; gap: 5px; }
        .cal-nav-btns button { width: 34px; height: 34px; background: #111; border: 1px solid #222; border-radius: 8px; color: #fff; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .cal-nav-btns button:hover { background: #e61e2a; border-color: #e61e2a; }

        .insight-grid { display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem; margin-top: 1.5rem; }
        .mini-stats-row { display: flex; flex-direction: column; gap: 1rem; }
        .premium-min-card { background: #0a0a0a; border: 1px solid #1a1a1a; padding: 1.5rem; border-radius: 16px; display: flex; flex-direction: column; gap: 0.5rem; }
        .premium-min-card span { font-size: 0.7rem; color: #555; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; }
        .premium-min-card strong { font-size: 1.8rem; color: #fff; }
        .premium-min-card.highlight strong { color: #e61e2a; }

        .presence-calendar { padding: 1.5rem; }
        .p-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
        .p-cal-day-name { text-align: center; font-size: 0.7rem; color: #444; font-weight: 800; padding: 0.5rem 0; text-transform: uppercase; }
        .p-cal-day { height: 60px; background: rgba(255,255,255,0.02); border: 1px solid #111; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; font-weight: 600; color: #555; }
        .p-cal-day.empty { background: transparent; border: none; }
        .p-cal-day.present { background: rgba(0,255,10,0.05); border-color: rgba(0,255,10,0.1); color: #00ff0a; }
        .p-marker { width: 8px; height: 8px; background: #00ff0a; border-radius: 50%; box-shadow: 0 0 10px #00ff0a; position: absolute; bottom: 10px; }

        .insight-controls { display: flex; gap: 1rem; align-items: center; }
        .i-select { background: #111; border: 1px solid #222; color: #fff; padding: 0.6rem 1rem; border-radius: 8px; font-weight: 600; outline: none; min-width: 200px; }
        .cal-nav-btns { display: flex; gap: 5px; }
        .cal-nav-btns button { width: 34px; height: 34px; background: #111; border: 1px solid #222; border-radius: 8px; color: #fff; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .cal-nav-btns button:hover { background: #e61e2a; border-color: #e61e2a; }

        .insight-grid { display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem; margin-top: 1.5rem; }
        .mini-stats-row { display: flex; flex-direction: column; gap: 1rem; }
        .premium-min-card { background: #0a0a0a; border: 1px solid #1a1a1a; padding: 1.5rem; border-radius: 16px; display: flex; flex-direction: column; gap: 0.5rem; }
        .premium-min-card span { font-size: 0.7rem; color: #555; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; }
        .premium-min-card strong { font-size: 1.8rem; color: #fff; }
        .premium-min-card.highlight strong { color: #e61e2a; }

        .presence-calendar { padding: 1.5rem; }
        .p-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
        .p-cal-day-name { text-align: center; font-size: 0.7rem; color: #444; font-weight: 800; padding: 0.5rem 0; text-transform: uppercase; }
        .p-cal-day { height: 60px; background: rgba(255,255,255,0.02); border: 1px solid #111; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; font-weight: 600; color: #555; }
        .p-cal-day.empty { background: transparent; border: none; }
        .p-cal-day.present { background: rgba(0,255,10,0.05); border-color: rgba(0,255,10,0.1); color: #00ff0a; }
        .p-marker { width: 8px; height: 8px; background: #00ff0a; border-radius: 50%; box-shadow: 0 0 10px #00ff0a; position: absolute; bottom: 10px; }

        @media (max-width: 1024px) {
          .admin-sidebar { width: 80px; padding: 2rem 0.5rem; }
          .admin-sidebar .logo span, .admin-sidebar .nav-item span, .admin-sidebar .brand-header p, .admin-sidebar .nav-item { font-size: 0; justify-content: center; }
          .admin-sidebar .nav-item { padding: 1.2rem; }
          .admin-sidebar .nav-item svg { margin: 0; }
          .admin-main { max-width: calc(100vw - 80px); padding: 2rem; }
        }

        @media (max-width: 768px) {
          .admin-container { flex-direction: column; }
          .admin-sidebar { width: 100%; height: auto; position: relative; padding: 1rem; border-right: none; border-bottom: 1px solid #1a1a1a; flex-direction: row; align-items: center; justify-content: space-between; gap: 0.5rem; }
          .brand-header { margin: 0; text-align: left; }
          .nav-menu { display: flex; flex-direction: row; gap: 10px; flex: 1; overflow-x: auto; padding: 0 10px 5px 10px; -webkit-overflow-scrolling: touch; }
          .nav-menu::-webkit-scrollbar { display: none; }
          .nav-item { padding: 0.8rem; border-radius: 12px; flex-shrink: 0; min-width: max-content; }
          .sidebar-footer { flex-shrink: 0; margin-left: 10px; }
          .logout-btn { padding: 0.8rem; width: auto; border: none; background: rgba(255,255,255,0.05); }
          .logout-btn span { display: none; }
          .logout-btn svg { color: #e61e2a; }
          
          .admin-main { max-width: 100vw; padding: 1rem; }
          .admin-header { flex-direction: column; align-items: flex-start; gap: 1rem; margin-bottom: 2rem; }
          .admin-header h1 { font-size: 1.5rem; }
          .admin-header p { font-size: 0.75rem; }
          .search-bar { min-width: 100%; padding: 0.6rem 1rem; }
          
          .grid-3 { grid-template-columns: 1fr; gap: 1rem; }
          .main-content-split { grid-template-columns: 1fr; gap: 1.5rem; }
          
          .status-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.8rem; }
          .status-tile { padding: 0.6rem; }
          .tile-info strong { font-size: 0.8rem; }
          
          .mini-ledger-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .mini-ledger-table { min-width: 600px; }
          
          .detail-top { grid-template-columns: 1fr; gap: 1.5rem; }
          .d-pane.map { height: 150px; }

          .ledger-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .ledger-table { min-width: 800px; }
          
          .selfie-view img { max-width: 100px; }
          .detail-split { grid-template-columns: 1fr; gap: 1.5rem; }

          /* Insights Responsive */
          .table-header-row { flex-direction: column; align-items: flex-start; gap: 1rem; }
          .insight-controls { width: 100%; flex-wrap: wrap; }
          .i-select { width: 100%; font-size: 0.85rem; }
          .insight-grid { grid-template-columns: 1fr; }
          .p-cal-grid { gap: 4px; }
          .p-cal-day { height: 45px; font-size: 0.75rem; }
          .p-marker { width: 6px; height: 6px; bottom: 5px; }
        }

        @media (max-width: 480px) {
           .nav-item { padding: 0.5rem; }
           .logo { font-size: 1.1rem; }
           .admin-main { padding: 0.8rem; }
           .premium-min-card strong { font-size: 1.4rem; }
           .p-cal-day-name { font-size: 0.6rem; }
        }
      `}</style>
    </div>
  );
}
