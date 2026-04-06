"use client";

import Image from 'next/image';
import Link from 'next/link';


import React, { useState, useEffect } from 'react';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUser = () => {
      const savedUser = localStorage.getItem('user');
      setUser(savedUser ? JSON.parse(savedUser) : null);
    };
    checkUser();
    // Watch for login/logout in other tabs or same tab redirects
    window.addEventListener('storage', checkUser);
    return () => window.removeEventListener('storage', checkUser);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  return (
    <nav className="navbar fade-in">
      <Link href="/" className="logo-container">
        <div className="logo-icon active-glow">
          <Image src="/logo.png" alt="MWG Logo" width={32} height={32} style={{ borderRadius: '4px' }} />
        </div>
        <div className="logo-text slide-right">
          White Gloves <span>Technologies</span>
        </div>
      </Link>

      
      <div className="nav-links">
        <Link href="/" className="nav-link active">Home</Link>
        <Link href="#" className="nav-link">Workforce</Link>
        <Link href="#" className="nav-link">Reports</Link>
        <Link href="#" className="nav-link">Settings</Link>
      </div>

      <div className="nav-actions">
        {!user ? (
          <>
            <Link href="/login" className="btn-secondary">Login</Link>
            <Link href="/signup" className="btn-primary">Get Started</Link>
          </>
        ) : (
          <button onClick={handleLogout} className="btn-primary logout-btn">Logout</button>
        )}
      </div>

      <style jsx>{`
        .navbar {
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 5%;
          background: rgba(10, 10, 10, 0.8);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .logo-container {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .logo-icon {
          width: 44px;
          height: 44px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          transition: all 0.4s ease;
          overflow: hidden;
        }

        .logo-icon:hover {
          background: var(--primary);
          transform: rotate(5deg) scale(1.1);
          box-shadow: 0 0 20px rgba(230, 30, 42, 0.6);
        }

        .active-glow {
          box-shadow: 0 0 10px rgba(230, 30, 42, 0.3);
        }


        .logo-text {
          font-weight: 800;
          font-size: 1.2rem;
          font-family: 'Outfit', sans-serif;
          letter-spacing: -0.5px;
        }

        .logo-text span {
          color: var(--primary);
          font-weight: 300;
        }

        .nav-links {
          display: flex;
          gap: 2.5rem;
        }

        .nav-link {
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text-gray);
          transition: all 0.3s ease;
          position: relative;
        }

        .nav-link:hover, .nav-link.active {
          color: white;
        }

        .nav-link.active::after {
          content: '';
          position: absolute;
          bottom: -5px;
          left: 0;
          width: 20px;
          height: 2px;
          background: var(--primary);
          border-radius: 2px;
        }

        .nav-actions {
          display: flex;
          gap: 1rem;
        }

        .btn-secondary {
          color: white;
          font-weight: 600;
          font-size: 0.9rem;
          padding: 0.7rem 1.5rem;
          border-radius: 10px;
          transition: background 0.3s ease;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .btn-primary {
          background: var(--primary);
          color: white;
          font-weight: 600;
          font-size: 0.9rem;
          padding: 0.7rem 1.5rem;
          border-radius: 10px;
          transition: all 0.3s ease;
        }

        .btn-primary:hover {
          background: var(--primary-hover);
          box-shadow: 0 5px 15px rgba(230, 30, 42, 0.3);
          transform: translateY(-1px);
        }

        @media (max-width: 900px) {
          .nav-links {
            display: none;
          }
        }
      `}</style>
    </nav>
  );
}
