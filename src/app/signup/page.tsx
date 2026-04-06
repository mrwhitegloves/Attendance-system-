"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [staffType, setStaffType] = useState('Office Staff');
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          employeeId,
          department,
          staffType,
        }),
      });

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const userData = await res.json();
        if (res.ok) {
          localStorage.setItem('user', JSON.stringify(userData));
          window.location.href = '/'; // Hard redirect to ensure storage sync
        } else {
          alert(userData.error || 'Signup failed');
        }
      } else {
         const errorText = await res.text();
         console.error("Server returned non-JSON response:", errorText);
         alert("Server configuration error. Please check your database connection.");
      }
    } catch (err) {
      console.error('Signup error:', err);
      alert('An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-wrapper">
      <div className="signup-card slide-up">
        <div className="signup-header">
          <Link href="/">
            <div className="logo">W <span>Technologies</span></div>
          </Link>
          <h1>Join Workforce</h1>
          <p>Create your workforce account</p>
        </div>

        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="input-row">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input 
                type="text" 
                id="name" 
                placeholder="John Doe" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="employeeId">Employee ID</label>
              <input 
                type="text" 
                id="employeeId" 
                placeholder="WG-12345" 
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required 
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input 
              type="email" 
              id="email" 
              placeholder="name@company.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="input-row">
            <div className="form-group">
              <label htmlFor="department">Department</label>
              <select
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
              >
                <option value="">Select Dept</option>
                <option value="Engineering" style={{color: '#000'}}>Engineering</option>
                <option value="Marketing" style={{color: '#000'}}>Marketing</option>
                <option value="Operations" style={{color: '#000'}}>Operations</option>
                <option value="Design" style={{color: '#000'}}>Design</option>
                <option value="HR" style={{color: '#000'}}>HR</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="staffType">Staff Type</label>
              <select
                id="staffType"
                value={staffType}
                onChange={(e) => setStaffType(e.target.value)}
                required
              >
                <option value="Office Staff" style={{color: '#000'}}>Office Staff</option>
                <option value="Field Staff" style={{color: '#000'}}>Field Staff</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input 
              type="password" 
              id="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <button type="submit" className="signup-btn" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="signup-footer">
          <p>Already have an account? <Link href="/login" className="login-link">Sign In</Link></p>
        </div>
      </div>

      <style jsx>{`
        .signup-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: #050505;
          position: relative;
        }

        .signup-card {
          width: 100%;
          max-width: 500px;
          background: #111;
          padding: 2.5rem;
          border-radius: 24px;
          border: 1px solid #222;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        }

        .signup-header { text-align: center; margin-bottom: 2rem; }
        .logo { font-weight: 800; font-size: 1.5rem; margin-bottom: 1rem; color: #fff; }
        .logo span { color: var(--primary); }
        h1 { font-size: 1.8rem; color: #fff; margin-bottom: 0.5rem; }
        p { color: #888; font-size: 0.9rem; }

        .signup-form { display: flex; flex-direction: column; gap: 1.2rem; }
        .input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
        label { font-size: 0.8rem; font-weight: 600; color: #aaa; text-transform: uppercase; }

        input, select {
          background: #1a1a1a;
          border: 1px solid #333;
          padding: 0.8rem 1rem;
          border-radius: 10px;
          color: #fff;
          font-size: 1rem;
          width: 100%;
        }

        input::placeholder { color: #555; }

        select option { background: #fff; color: #000; }

        .signup-btn {
          background: var(--primary);
          color: white;
          padding: 1rem;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 700;
          margin-top: 1rem;
        }

        .signup-footer { margin-top: 1.5rem; text-align: center; color: #666; font-size: 0.9rem; }
        .login-link { color: var(--primary); font-weight: 600; }

        @media (max-width: 480px) {
          .signup-card {
            padding: 2rem;
          }
        }
      `}</style>
    </div>
  );
}
