import React, { useState, useEffect } from 'react';
import { MapPin, Calendar, BarChart3, FileText, Clock, TrendingUp, Users, AlertCircle } from 'lucide-react';

const AttendanceMobileApp = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isPunched, setIsPunched] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const recentLogs = [
    { date: 'Apr 06, 2026', punchIn: '02:33 PM', punchOut: '12:58 PM', verified: true },
    { date: 'Apr 04, 2026', punchIn: '09:15 AM', punchOut: '06:30 PM', verified: true },
    { date: 'Apr 03, 2026', punchIn: '09:20 AM', punchOut: '06:15 PM', verified: true },
  ];

  const calendarDays = Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    status: [4, 6].includes(i + 1) ? 'present' : i + 1 > 6 ? 'future' : 'absent'
  }));

  const DashboardView = () => (
    <div className="dashboard-view">
      <div className="hero-section">
        <div className="time-display">
          <div className="system-time">
            <span className="label">System Time</span>
            <div className="time">{formatTime(currentTime)}</div>
            <div className="date">{formatDate(currentTime)}</div>
          </div>
        </div>

        <div className="location-info">
          <MapPin size={14} />
          <span>Adityapur, Seraikela-Kharsawan, Jharkhand</span>
        </div>

        <button 
          className={`punch-button ${isPunched ? 'punched' : ''}`}
          onClick={() => setIsPunched(!isPunched)}
        >
          <div className="punch-ripple"></div>
          <div className="punch-content">
            <Clock size={32} />
            <span>{isPunched ? 'PUNCH OUT' : 'PUNCH IN'}</span>
          </div>
        </button>
      </div>

      <div className="logs-section">
        <div className="section-header">
          <h3>Recent Activity</h3>
          <button className="view-all">View All</button>
        </div>

        <div className="logs-list">
          {recentLogs.map((log, idx) => (
            <div key={idx} className="log-card">
              <div className="log-date">
                <Calendar size={16} />
                <span>{log.date}</span>
              </div>
              <div className="log-times">
                <div className="time-entry in">
                  <span className="label">In</span>
                  <span className="value">{log.punchIn}</span>
                </div>
                <div className="time-divider">→</div>
                <div className="time-entry out">
                  <span className="label">Out</span>
                  <span className="value">{log.punchOut}</span>
                </div>
              </div>
              {log.verified && (
                <div className="verified-badge">
                  <div className="pulse"></div>
                  Verified
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const CalendarView = () => (
    <div className="calendar-view">
      <div className="calendar-header">
        <h2>April 2026</h2>
        <div className="legend">
          <div className="legend-item">
            <div className="dot present"></div>
            <span>Present</span>
          </div>
          <div className="legend-item">
            <div className="dot absent"></div>
            <span>Pending</span>
          </div>
        </div>
      </div>

      <div className="calendar-grid">
        <div className="weekday-labels">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="weekday">{day}</div>
          ))}
        </div>
        <div className="calendar-days">
          {calendarDays.map(({ day, status }) => (
            <div key={day} className={`calendar-day ${status}`}>
              <span className="day-number">{day}</span>
              {status === 'present' && <div className="status-indicator"></div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const ReportsView = () => (
    <div className="reports-view">
      <div className="stats-grid">
        <div className="stat-card working">
          <div className="stat-icon">
            <Calendar size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Working Days</div>
            <div className="stat-value">2</div>
          </div>
        </div>

        <div className="stat-card leave">
          <div className="stat-icon">
            <FileText size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Monthly Leave</div>
            <div className="stat-value">0</div>
          </div>
        </div>

        <div className="stat-card late">
          <div className="stat-icon">
            <AlertCircle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Late Arrivals</div>
            <div className="stat-value">2</div>
          </div>
        </div>
      </div>

      <div className="chart-section">
        <h3>Productivity Trends</h3>
        <div className="chart-placeholder">
          <div className="chart-bars">
            {Array.from({ length: 30 }, (_, i) => (
              <div 
                key={i} 
                className="bar" 
                style={{ height: `${Math.random() * 60 + 20}%` }}
              ></div>
            ))}
          </div>
        </div>
      </div>

      <div className="heatmap-section">
        <h3>Attendance Heatmap</h3>
        <div className="heatmap-grid">
          {Array.from({ length: 35 }, (_, i) => (
            <div 
              key={i} 
              className={`heatmap-cell ${i === 33 || i === 34 ? 'active' : ''}`}
            ></div>
          ))}
        </div>
        <p className="heatmap-label">Last 5 weeks of performance</p>
      </div>
    </div>
  );

  const LeaveModal = () => (
    <div className={`modal-overlay ${showLeaveModal ? 'show' : ''}`} onClick={() => setShowLeaveModal(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Request Formal Leave</h2>
        <textarea placeholder="Reason for leave..." rows={5}></textarea>
        <button className="submit-btn">Submit Request</button>
        <div className="contact-options">
          <button className="contact-btn gmail">
            <span>📧</span> Gmail HR
          </button>
          <button className="contact-btn whatsapp">
            <span>💬</span> WhatsApp
          </button>
        </div>
        <button className="close-btn" onClick={() => setShowLeaveModal(false)}>Close</button>
      </div>
    </div>
  );

  return (
    <div className="attendance-app">
      <header className="app-header">
        <div className="header-content">
          <div className="brand">
            <div className="logo">W</div>
            <div className="brand-text">
              <div className="company">White Gloves</div>
              <div className="tagline">Technologies</div>
            </div>
          </div>
          <div className="user-info">
            <div className="user-details">
              <div className="user-name">Aryan</div>
              <div className="user-role">Office Staff</div>
            </div>
            <div className="user-avatar">A</div>
          </div>
        </div>
      </header>

      <main className="app-content">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'reports' && <ReportsView />}
        {activeTab === 'leave' && (
          <div className="leave-view">
            <button className="apply-leave-btn" onClick={() => setShowLeaveModal(true)}>
              <FileText size={24} />
              <span>Apply for Leave</span>
            </button>
          </div>
        )}
      </main>

      <nav className="bottom-nav">
        <button 
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <BarChart3 size={22} />
          <span>Dashboard</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          <Calendar size={22} />
          <span>Attendance</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          <TrendingUp size={22} />
          <span>Reports</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'leave' ? 'active' : ''}`}
          onClick={() => setActiveTab('leave')}
        >
          <FileText size={22} />
          <span>Leave</span>
        </button>
      </nav>

      <LeaveModal />

      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .attendance-app {
          min-height: 100vh;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
          color: #ffffff;
          padding-bottom: 80px;
        }

        .app-header {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding: 16px 20px;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 20px;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }

        .brand-text {
          line-height: 1.2;
        }

        .company {
          font-weight: 600;
          font-size: 16px;
          letter-spacing: -0.02em;
        }

        .tagline {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-details {
          text-align: right;
          line-height: 1.3;
        }

        .user-name {
          font-weight: 600;
          font-size: 14px;
        }

        .user-role {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
        }

        .app-content {
          padding: 20px;
          animation: fadeIn 0.5s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Dashboard View */
        .hero-section {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 24px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .time-display {
          text-align: center;
          margin-bottom: 20px;
        }

        .system-time .label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(255, 255, 255, 0.5);
          display: block;
          margin-bottom: 12px;
        }

        .time {
          font-size: 48px;
          font-weight: 700;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.8) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 4px;
        }

        .date {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
        }

        .location-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 24px;
        }

        .punch-button {
          width: 100%;
          height: 140px;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          border: none;
          border-radius: 20px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4);
          transition: all 0.3s ease;
        }

        .punch-button:active {
          transform: scale(0.98);
        }

        .punch-button.punched {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
        }

        .punch-ripple {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
          opacity: 0;
          animation: ripple 2s infinite;
        }

        @keyframes ripple {
          0%, 100% {
            opacity: 0;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }

        .punch-content {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          height: 100%;
        }

        .punch-content span {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        /* Logs Section */
        .logs-section {
          margin-top: 24px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .section-header h3 {
          font-size: 18px;
          font-weight: 600;
        }

        .view-all {
          background: none;
          border: none;
          color: #ef4444;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        .logs-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .log-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 16px;
          transition: all 0.3s ease;
        }

        .log-card:active {
          background: rgba(255, 255, 255, 0.08);
        }

        .log-date {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 12px;
        }

        .log-times {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .time-entry {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .time-entry .label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .time-entry .value {
          font-size: 16px;
          font-weight: 600;
        }

        .time-entry.in .value {
          color: #10b981;
        }

        .time-entry.out .value {
          color: #f59e0b;
        }

        .time-divider {
          color: rgba(255, 255, 255, 0.3);
        }

        .verified-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #10b981;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .pulse {
          width: 6px;
          height: 6px;
          background: #10b981;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.2);
          }
        }

        /* Calendar View */
        .calendar-view {
          animation: fadeIn 0.5s ease;
        }

        .calendar-header {
          margin-bottom: 24px;
        }

        .calendar-header h2 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.7) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .legend {
          display: flex;
          gap: 20px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .dot.present {
          background: #10b981;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
        }

        .dot.absent {
          background: rgba(255, 255, 255, 0.2);
        }

        .calendar-grid {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 20px;
        }

        .weekday-labels {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        }

        .weekday {
          text-align: center;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }

        .calendar-days {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
        }

        .calendar-day {
          aspect-ratio: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          position: relative;
          transition: all 0.3s ease;
        }

        .calendar-day.present {
          background: rgba(16, 185, 129, 0.15);
          border-color: rgba(16, 185, 129, 0.3);
        }

        .calendar-day.future {
          opacity: 0.3;
        }

        .day-number {
          font-size: 14px;
          font-weight: 500;
        }

        .status-indicator {
          position: absolute;
          bottom: 4px;
          width: 4px;
          height: 4px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);
        }

        /* Reports View */
        .reports-view {
          animation: fadeIn 0.5s ease;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 16px 12px;
          text-align: center;
          transition: all 0.3s ease;
        }

        .stat-card.working {
          border-color: rgba(99, 102, 241, 0.3);
        }

        .stat-card.leave {
          border-color: rgba(245, 158, 11, 0.3);
        }

        .stat-card.late {
          border-color: rgba(239, 68, 68, 0.3);
        }

        .stat-icon {
          width: 40px;
          height: 40px;
          margin: 0 auto 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.1);
        }

        .stat-card.working .stat-icon {
          color: #6366f1;
        }

        .stat-card.leave .stat-icon {
          color: #f59e0b;
        }

        .stat-card.late .stat-icon {
          color: #ef4444;
        }

        .stat-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 700;
        }

        .chart-section,
        .heatmap-section {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .chart-section h3,
        .heatmap-section h3 {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .chart-bars {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 120px;
        }

        .bar {
          flex: 1;
          background: linear-gradient(180deg, #10b981 0%, #059669 100%);
          border-radius: 3px 3px 0 0;
          opacity: 0.8;
          transition: all 0.3s ease;
        }

        .heatmap-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
          margin-bottom: 12px;
        }

        .heatmap-cell {
          aspect-ratio: 1;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          transition: all 0.3s ease;
        }

        .heatmap-cell.active {
          background: #10b981;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
        }

        .heatmap-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          text-align: center;
        }

        /* Leave View */
        .leave-view {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 300px;
        }

        .apply-leave-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          border: none;
          border-radius: 20px;
          padding: 32px 48px;
          color: white;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4);
          transition: all 0.3s ease;
        }

        .apply-leave-btn:active {
          transform: scale(0.98);
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          opacity: 0;
          pointer-events: none;
          transition: all 0.3s ease;
          z-index: 1000;
        }

        .modal-overlay.show {
          opacity: 1;
          pointer-events: all;
        }

        .modal-content {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 32px 24px;
          max-width: 400px;
          width: 100%;
          transform: scale(0.9);
          transition: all 0.3s ease;
        }

        .modal-overlay.show .modal-content {
          transform: scale(1);
        }

        .modal-content h2 {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 20px;
          text-align: center;
        }

        .modal-content textarea {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 16px;
          color: white;
          font-size: 14px;
          font-family: inherit;
          resize: none;
          margin-bottom: 16px;
        }

        .modal-content textarea::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .submit-btn {
          width: 100%;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          border: none;
          border-radius: 12px;
          padding: 16px;
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 16px;
          transition: all 0.3s ease;
        }

        .submit-btn:active {
          transform: scale(0.98);
        }

        .contact-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }

        .contact-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 12px;
          color: white;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .contact-btn:active {
          background: rgba(255, 255, 255, 0.1);
        }

        .close-btn {
          width: 100%;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
          padding: 12px;
          cursor: pointer;
        }

        /* Bottom Navigation */
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(10, 10, 10, 0.95);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          padding: 12px 8px;
          padding-bottom: calc(12px + env(safe-area-inset-bottom));
          z-index: 100;
        }

        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          padding: 8px 4px;
          border-radius: 12px;
          transition: all 0.3s ease;
        }

        .nav-item span {
          font-size: 11px;
          font-weight: 500;
        }

        .nav-item.active {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        .nav-item:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  );
};

export default AttendanceMobileApp;
