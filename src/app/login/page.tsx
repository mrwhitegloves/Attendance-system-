"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const userData = await res.json();
        localStorage.setItem('user', JSON.stringify(userData));
        router.push('/');
      } else {
        const error = await res.json();
        alert(error.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card slide-up">
        <div className="login-header">
          <Link href="/">
            <div className="logo">W <span>Technologies</span></div>
          </Link>
          <h1>Welcome Back</h1>
          <p>Login to your workforce account</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email or Username</label>
            <input 
              type="text" 
              id="email" 
              placeholder="e.g. whitegloves" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="form-group">
            <div className="label-row">
              <label htmlFor="password">Password</label>
              <a href="#" className="forgot-password">Forgot?</a>
            </div>
            <input 
              type="password" 
              id="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <p>Don&apos;t have an account? <Link href="/signup" className="signup-link">Create one</Link></p>
        </div>
      </div>

      <style jsx>{`
        .login-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: var(--bg-dark);
          position: relative;
          overflow: hidden;
        }

        .login-wrapper::before {
          content: '';
          position: absolute;
          top: -20%;
          left: -10%;
          width: 50%;
          height: 50%;
          background: radial-gradient(circle, var(--primary) 0%, transparent 70%);
          opacity: 0.15;
          filter: blur(80px);
        }

        .login-card {
          width: 100%;
          max-width: 450px;
          background: var(--bg-card);
          padding: 3rem;
          border-radius: 24px;
          border: 1px solid var(--border);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          position: relative;
          z-index: 1;
        }

        .login-header {
          text-align: center;
          margin-bottom: 2.5rem;
        }

        .logo {
          font-weight: 800;
          font-family: 'Outfit', sans-serif;
          font-size: 1.5rem;
          margin-bottom: 1.5rem;
          cursor: pointer;
        }

        .logo span {
          color: var(--primary);
        }

        h1 {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          letter-spacing: -0.5px;
        }

        p {
          color: var(--text-gray);
          font-size: 1rem;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        label {
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text-white);
        }

        .forgot-password {
          font-size: 0.85rem;
          color: var(--primary);
          font-weight: 500;
        }

        input {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border);
          padding: 1rem 1.2rem;
          border-radius: 12px;
          color: white;
          font-size: 1rem;
          transition: all 0.3s ease;
        }

        input:focus {
          outline: none;
          border-color: var(--primary);
          background: rgba(255, 255, 255, 0.05);
          box-shadow: 0 0 0 4px rgba(230, 30, 42, 0.1);
        }

        .login-btn {
          margin-top: 1rem;
          background: var(--primary);
          color: white;
          padding: 1rem;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 700;
          transition: all 0.3s ease;
        }

        .login-btn:hover {
          background: var(--primary-hover);
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(230, 30, 42, 0.3);
        }

        .login-footer {
          margin-top: 2rem;
          text-align: center;
          font-size: 0.95rem;
        }

        .signup-link {
          color: var(--primary);
          font-weight: 600;
        }

        .signup-link:hover {
          text-decoration: underline;
        }

        @media (max-width: 480px) {
          .login-card {
            padding: 2rem;
          }
        }
      `}</style>
    </div>
  );
}
