import React, { useState, useEffect } from 'react';
import { Menu, X, Users, TrendingUp, Shield, Zap, ArrowRight, Play, Check } from 'lucide-react';

const LandingPageMobile = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [liveCount, setLiveCount] = useState(1432);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveCount(prev => prev + Math.floor(Math.random() * 3) - 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: <Users size={24} />,
      title: "Real-Time Tracking",
      description: "Monitor attendance instantly with live updates across your entire workforce"
    },
    {
      icon: <TrendingUp size={24} />,
      title: "Smart Analytics",
      description: "Gain insights with AI-powered reports and productivity trends"
    },
    {
      icon: <Shield size={24} />,
      title: "Secure & Reliable",
      description: "Enterprise-grade security with biometric verification"
    },
    {
      icon: <Zap size={24} />,
      title: "Lightning Fast",
      description: "Seamless performance with instant sync across all devices"
    }
  ];

  const stats = [
    { value: "50K+", label: "Active Users" },
    { value: "99.9%", label: "Uptime" },
    { value: "24/7", label: "Support" }
  ];

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="brand">
            <div className="logo">W</div>
            <div className="brand-text">
              <span className="company">White Gloves</span>
              <span className="tech">Technologies</span>
            </div>
          </div>

          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <div className={`nav-menu ${menuOpen ? 'open' : ''}`}>
          <a href="#home" onClick={() => setMenuOpen(false)}>Home</a>
          <a href="#workforce" onClick={() => setMenuOpen(false)}>Workforce</a>
          <a href="#reports" onClick={() => setMenuOpen(false)}>Reports</a>
          <a href="#settings" onClick={() => setMenuOpen(false)}>Settings</a>
          <div className="nav-actions">
            <button className="btn-secondary">Login</button>
            <button className="btn-primary">Get Started</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-background">
          <div className="grid-overlay"></div>
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
        </div>

        <div className="hero-content">
          <div className="live-indicator">
            <div className="pulse-dot"></div>
            <span>LIVE: {liveCount.toLocaleString()} Online</span>
          </div>

          <h1 className="hero-title">
            Digital<br />
            Attendance<br />
            for the<br />
            <span className="highlight">Modern<br />Workforce.</span>
          </h1>

          <p className="hero-description">
            Join White Gloves Technologies. Track your presence, 
            manage your profile, and stay connected with your team 
            anywhere, anytime.
          </p>

          <div className="hero-actions">
            <button className="btn-cta">
              Get Started Free
              <ArrowRight size={20} />
            </button>
            <button className="btn-demo">
              <Play size={18} />
              Watch Demo
            </button>
          </div>

          <div className="trust-badges">
            <div className="badge">
              <Check size={16} />
              <span>No credit card required</span>
            </div>
            <div className="badge">
              <Check size={16} />
              <span>14-day free trial</span>
            </div>
          </div>
        </div>

        {/* Futuristic Interface Preview */}
        <div className="preview-container">
          <div className="preview-frame">
            <div className="scan-animation"></div>
            <div className="interface-card">
              <div className="card-header">
                <div className="status-light"></div>
                <span>SYSTEM ACCESS</span>
              </div>
              <div className="profile-section">
                <div className="avatar-placeholder"></div>
                <div className="profile-info">
                  <div className="info-line"></div>
                  <div className="info-line short"></div>
                </div>
              </div>
              <div className="stats-grid">
                <div className="stat-box"></div>
                <div className="stat-box"></div>
                <div className="stat-box"></div>
              </div>
              <div className="access-indicator">
                <div className="eye-icon"></div>
                <div className="scan-line"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="stats-bar">
        {stats.map((stat, idx) => (
          <div key={idx} className="stat-item">
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="section-header">
          <h2>Everything You Need</h2>
          <p>Powerful features for modern workforce management</p>
        </div>

        <div className="features-grid">
          {features.map((feature, idx) => (
            <div key={idx} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Ready to Transform Your Workforce?</h2>
          <p>Start tracking attendance smarter, not harder.</p>
          <button className="btn-cta-large">
            Get Started Now
            <ArrowRight size={24} />
          </button>
        </div>
      </section>

      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .landing-page {
          min-height: 100vh;
          background: #000000;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
          overflow-x: hidden;
        }

        /* Navigation */
        .navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding: 16px 20px;
          z-index: 1000;
        }

        .nav-container {
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
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 20px;
          box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
        }

        .brand-text {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }

        .company {
          font-weight: 700;
          font-size: 16px;
        }

        .tech {
          font-size: 11px;
          color: #ef4444;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .menu-toggle {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: all 0.3s ease;
        }

        .menu-toggle:active {
          background: rgba(255, 255, 255, 0.1);
        }

        .nav-menu {
          position: fixed;
          top: 73px;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.98);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          transform: translateY(-100%);
          opacity: 0;
          transition: all 0.3s ease;
          pointer-events: none;
        }

        .nav-menu.open {
          transform: translateY(0);
          opacity: 1;
          pointer-events: all;
        }

        .nav-menu a {
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;
          font-size: 16px;
          font-weight: 500;
          padding: 12px 16px;
          border-radius: 8px;
          transition: all 0.3s ease;
        }

        .nav-menu a:active {
          background: rgba(255, 255, 255, 0.05);
          color: white;
        }

        .nav-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .btn-secondary {
          flex: 1;
          padding: 14px 24px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: white;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-primary {
          flex: 1;
          padding: 14px 24px;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
          transition: all 0.3s ease;
        }

        /* Hero Section */
        .hero {
          padding: 100px 20px 60px;
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .hero-background {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(239, 68, 68, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(239, 68, 68, 0.03) 1px, transparent 1px);
          background-size: 30px 30px;
          opacity: 0.5;
        }

        .gradient-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.3;
          animation: float 8s ease-in-out infinite;
        }

        .orb-1 {
          width: 300px;
          height: 300px;
          background: #ef4444;
          top: -100px;
          right: -100px;
        }

        .orb-2 {
          width: 250px;
          height: 250px;
          background: #dc2626;
          bottom: 0;
          left: -50px;
          animation-delay: -4s;
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(20px, -20px) scale(1.1);
          }
        }

        .hero-content {
          position: relative;
          z-index: 10;
        }

        .live-indicator {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          padding: 8px 16px;
          border-radius: 20px;
          margin-bottom: 24px;
          font-size: 12px;
          font-weight: 600;
          color: #10b981;
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.1);
            box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
          }
        }

        .hero-title {
          font-size: 56px;
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 24px;
          letter-spacing: -0.03em;
        }

        .highlight {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-description {
          font-size: 16px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 32px;
          max-width: 500px;
        }

        .hero-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
        }

        .btn-cta {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 18px 28px;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          border: none;
          border-radius: 14px;
          color: white;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4);
          transition: all 0.3s ease;
        }

        .btn-cta:active {
          transform: translateY(2px);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
        }

        .btn-demo {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 18px 24px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-demo:active {
          background: rgba(255, 255, 255, 0.1);
        }

        .trust-badges {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .badge {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
        }

        .badge svg {
          color: #10b981;
        }

        /* Preview Container */
        .preview-container {
          margin-top: 40px;
          perspective: 1000px;
        }

        .preview-frame {
          position: relative;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 20px;
          padding: 20px;
          transform: rotateX(5deg) rotateY(-5deg);
          transition: transform 0.3s ease;
        }

        .scan-animation {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, 
            transparent 0%, 
            #ef4444 50%, 
            transparent 100%
          );
          animation: scan 3s ease-in-out infinite;
        }

        @keyframes scan {
          0%, 100% {
            transform: translateY(0);
            opacity: 0;
          }
          50% {
            transform: translateY(300px);
            opacity: 1;
          }
        }

        .interface-card {
          background: linear-gradient(135deg, 
            rgba(239, 68, 68, 0.1) 0%, 
            rgba(0, 0, 0, 0.8) 100%
          );
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 16px;
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 20px;
        }

        .status-light {
          width: 8px;
          height: 8px;
          background: #ef4444;
          border-radius: 50%;
          box-shadow: 0 0 12px #ef4444;
          animation: blink 2s infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .card-header span {
          font-size: 11px;
          letter-spacing: 0.1em;
          color: #ef4444;
          font-weight: 700;
        }

        .profile-section {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
          padding: 16px;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 12px;
        }

        .avatar-placeholder {
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          border-radius: 12px;
          position: relative;
        }

        .avatar-placeholder::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 12px;
          border: 2px solid #ef4444;
          animation: borderPulse 2s infinite;
        }

        @keyframes borderPulse {
          0%, 100% {
            opacity: 0;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }

        .profile-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
          justify-content: center;
        }

        .info-line {
          height: 8px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          animation: shimmer 2s infinite;
        }

        .info-line.short {
          width: 60%;
        }

        @keyframes shimmer {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 20px;
        }

        .stat-box {
          height: 40px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 8px;
        }

        .access-indicator {
          position: relative;
          height: 80px;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .eye-icon {
          width: 40px;
          height: 40px;
          border: 3px solid #ef4444;
          border-radius: 50%;
          position: relative;
          z-index: 2;
        }

        .eye-icon::before {
          content: '';
          position: absolute;
          inset: 8px;
          background: #ef4444;
          border-radius: 50%;
          animation: eyePulse 1.5s infinite;
        }

        @keyframes eyePulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(0.8);
            opacity: 0.6;
          }
        }

        .scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, 
            transparent 0%, 
            #ef4444 50%, 
            transparent 100%
          );
          animation: verticalScan 2s ease-in-out infinite;
        }

        @keyframes verticalScan {
          0%, 100% {
            top: 10%;
            opacity: 0;
          }
          50% {
            top: 90%;
            opacity: 1;
          }
        }

        /* Stats Bar */
        .stats-bar {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: rgba(255, 255, 255, 0.1);
          margin: 40px 20px;
          border-radius: 16px;
          overflow: hidden;
        }

        .stat-item {
          background: rgba(0, 0, 0, 0.8);
          padding: 24px;
          text-align: center;
        }

        .stat-value {
          font-size: 32px;
          font-weight: 800;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Features Section */
        .features {
          padding: 60px 20px;
        }

        .section-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .section-header h2 {
          font-size: 36px;
          font-weight: 800;
          margin-bottom: 12px;
          letter-spacing: -0.02em;
        }

        .section-header p {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.6);
        }

        .features-grid {
          display: grid;
          gap: 20px;
        }

        .feature-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 24px;
          transition: all 0.3s ease;
        }

        .feature-card:active {
          background: rgba(255, 255, 255, 0.05);
          transform: scale(0.98);
        }

        .feature-icon {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.1) 100%);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ef4444;
          margin-bottom: 16px;
        }

        .feature-card h3 {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .feature-card p {
          font-size: 14px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.6);
        }

        /* CTA Section */
        .cta-section {
          padding: 60px 20px;
          margin: 40px 20px;
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 24px;
          text-align: center;
        }

        .cta-content h2 {
          font-size: 32px;
          font-weight: 800;
          margin-bottom: 12px;
          letter-spacing: -0.02em;
        }

        .cta-content p {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 32px;
        }

        .btn-cta-large {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 20px 40px;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          border: none;
          border-radius: 16px;
          color: white;
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 12px 32px rgba(239, 68, 68, 0.4);
          transition: all 0.3s ease;
        }

        .btn-cta-large:active {
          transform: translateY(2px);
          box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
        }
      `}</style>
    </div>
  );
};

export default LandingPageMobile;
