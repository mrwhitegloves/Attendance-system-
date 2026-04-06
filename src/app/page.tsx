"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import AttendanceSystem from '@/components/AttendanceSystem';
import AdminDashboard from '@/components/AdminDashboard';
import Image from 'next/image';
import Link from 'next/link';

interface Profile {
  name: string;
  employeeId: string;
  department: string;
  staffType: 'Office Staff' | 'Field Staff';
  isAdmin?: boolean;
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setProfile(JSON.parse(savedUser));
    }
    setIsLoaded(true);
  }, []);

  if (!isLoaded) return null; // Prevent hydration mismatch

  return (
    <main className="main-wrapper">
      {!profile && <Navbar />}
      
      {!profile ? (
        <section className="hero-section">
          <div className="container">
            <div className="hero-content fade-in">
              <h1>Digital Attendance for the <span className="highlight">Modern Workforce.</span></h1>
              <p className="description">
                Join White Gloves Technologies. Track your presence, manage your profile, and stay connected with your team anywhere, anytime.
              </p>
              
              <div className="stats fade-in" style={{ animationDelay: '0.2s' }}>
                <div className="stat-item">
                  <span className="stat-number">10k+</span>
                  <span className="stat-label">Employees</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">99.9%</span>
                  <span className="stat-label">Uptime</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">24/7</span>
                  <span className="stat-label">Support</span>
                </div>
              </div>

              <div className="cta-container">
                <Link href="/signup">
                  <button className="get-started-btn">
                    Get Started Now <span>→</span>
                  </button>
                </Link>
              </div>
            </div>

            <div className="hero-image-container fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="image-card">
                <Image 
                  src="/hero.png" 
                  alt="Attendance Illustration" 
                  width={600} 
                  height={600} 
                  className="hero-img"
                  priority
                />
                <div className="floating-badge">
                  <span className="dot"></span>
                  LIVE: 1,432 Online
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : profile.isAdmin ? (
        <AdminDashboard profile={profile} />
      ) : (
        <AttendanceSystem profile={profile} />
      )}

      {(!profile || !profile.isAdmin) && (
        <footer className="footer fade-in">
          <div className="footer-container">
            <div className="footer-logo">W <span>Technologies</span></div>
            <div className="copyright">© 2026 White Gloves Technologies. All rights reserved.</div>
            <div className="socials">
              <Link href="/login" className="admin-link"><span>🛡️</span> Admin Portal</Link>
              <span className="social-link">Twitter</span>
              <span className="social-link">LinkedIn</span>
            </div>
          </div>
        </footer>
      )}

      <style jsx>{`
        .main-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 5%;
        }

        .hero-section {
          padding: 80px 0;
          display: flex;
          flex-direction: column;
          gap: 120px;
        }

        .hero-section .container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          align-items: center;
          gap: 4rem;
        }

        h1 {
          font-size: clamp(2.5rem, 6vw, 4.5rem);
          line-height: 1.1;
          font-weight: 800;
          margin-bottom: 2rem;
          font-family: 'Outfit', sans-serif;
          letter-spacing: -2px;
        }

        .highlight {
          color: var(--primary);
        }

        .description {
          font-size: 1.25rem;
          line-height: 1.6;
          color: var(--text-gray);
          max-width: 500px;
          margin-bottom: 3rem;
        }

        .stats {
          display: flex;
          gap: 3rem;
          margin-bottom: 3rem;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
        }

        .stat-number {
          font-size: 1.8rem;
          font-weight: 800;
          color: white;
        }

        .stat-label {
          font-size: 0.85rem;
          color: var(--text-gray);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .get-started-btn {
          background: var(--primary);
          color: white;
          padding: 1.2rem 2.5rem;
          border-radius: 50px;
          font-size: 1.1rem;
          font-weight: 700;
          transition: all 0.4s ease;
          display: flex;
          align-items: center;
          gap: 0.8rem;
          box-shadow: 0 0 30px rgba(230, 30, 42, 0.4);
        }

        .get-started-btn:hover {
          transform: translateY(-5px);
          box-shadow: 0 0 50px rgba(230, 30, 42, 0.6);
        }

        .hero-image-container {
          position: relative;
        }

        .image-card {
          position: relative;
          border-radius: 40px;
          overflow: hidden;
          box-shadow: 0 30px 60px rgba(0,0,0,0.5);
          transform: perspective(1000px) rotateY(-5deg);
          border: 1px solid var(--glass-border);
          transition: transform 0.6s ease;
        }

        .image-card:hover {
          transform: perspective(1000px) rotateY(0deg) translateY(-10px);
        }

        .hero-img {
          display: block;
          width: 100%;
          height: auto;
          filter: grayscale(0.2) contrast(1.1);
        }

        .floating-badge {
          position: absolute;
          top: 2rem;
          right: 2rem;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(10px);
          padding: 0.8rem 1.5rem;
          border-radius: 50px;
          font-size: 0.9rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
        }

        .dot {
          width: 10px;
          height: 10px;
          background: #00ff00;
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 10px #00ff00;
        }

        .form-section {
          padding: 100px 5%;
          display: flex;
          justify-content: center;
          background: linear-gradient(180deg, transparent, rgba(230, 30, 42, 0.05));
        }

        .form-wrapper {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .dashboard-section {
          padding: 60px 0;
          flex-grow: 1;
        }

        .dashboard-header {
          text-align: center;
          margin-bottom: 4rem;
        }

        .dashboard-header h1 {
          font-size: 3.5rem;
          margin-bottom: 0.5rem;
        }

        .dashboard-header p {
          color: var(--text-gray);
          font-size: 1.1rem;
        }

        .footer {
          padding: 60px 5%;
          border-top: 1px solid var(--border);
          background: #050505;
          margin-top: auto;
        }

        .footer-container {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .footer-logo {
          font-weight: 800;
          font-family: 'Outfit', sans-serif;
        }

        .footer-logo span {
          color: var(--primary);
        }

        .copyright {
          color: #555;
          font-size: 0.9rem;
        }

        .socials {
          display: flex;
          gap: 2rem;
          color: #555;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .admin-link {
          background: rgba(230, 30, 42, 0.1);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 50px;
          border: 1px solid rgba(230, 30, 42, 0.2);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 700;
          transition: 0.3s;
        }

        .admin-link:hover {
          background: #e61e2a;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(230, 30, 42, 0.3);
        }

        .social-link:hover {
          color: var(--primary);
          cursor: pointer;
        }

        @media (max-width: 900px) {
          .hero-section .container {
            grid-template-columns: 1fr;
            text-align: center;
            gap: 4rem;
          }
          .description {
            margin: 0 auto 3rem;
          }
          .stats {
            justify-content: center;
          }
          .cta-container {
            display: flex;
            justify-content: center;
          }
          .image-card {
            transform: none;
          }
          .footer-container {
            flex-direction: column;
            gap: 2rem;
            text-align: center;
          }
        }
      `}</style>
    </main>
  );
}
