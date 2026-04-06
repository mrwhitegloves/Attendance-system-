"use client";

import React, { useState } from 'react';

interface Profile {
  name: string;
  employeeId: string;
  department: string;
  staffType: 'Office Staff' | 'Field Staff';
}

export default function ProfileForm({ onComplete }: { onComplete: (profile: Profile) => void }) {
  const [formData, setFormData] = useState<Profile>({
    name: '',
    employeeId: '',
    department: '',
    staffType: 'Office Staff',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.employeeId) {
      onComplete(formData);
    }
  };

  return (
    <div className="form-container fade-in hover-lift">

      <h2>Create Your Profile</h2>
      <p className="subtitle">Enter your details to join White Gloves Technologies workforce</p>
      
      <form onSubmit={handleSubmit} className="profile-form">
        <div className="input-group">
          <label htmlFor="name">Full Name</label>
          <input
            type="text"
            id="name"
            placeholder="John Doe"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="employeeId">Employee ID</label>
          <input
            type="text"
            id="employeeId"
            placeholder="WG-12345"
            value={formData.employeeId}
            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
            required
          />
        </div>

        <div className="input-row">
          <div className="input-group">
            <label htmlFor="department">Department</label>
            <select
              id="department"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              required
            >
              <option value="">Select Dept</option>
              <option value="Engineering">Engineering</option>
              <option value="Marketing">Marketing</option>
              <option value="Operations">Operations</option>
              <option value="Design">Design</option>
              <option value="HR">HR</option>
            </select>
          </div>

          <div className="input-group">
            <label htmlFor="staffType">Staff Type</label>
            <select
              id="staffType"
              value={formData.staffType}
              onChange={(e) => setFormData({ ...formData, staffType: e.target.value as any })}
              required
            >
              <option value="Office Staff">Office Staff</option>
              <option value="Field Staff">Field Staff</option>
            </select>
          </div>
        </div>

        <button type="submit" className="btn-primary">
          Complete Profile <span>→</span>
        </button>
      </form>

      <style jsx>{`
        .form-container {
          background: var(--bg-card);
          padding: 2.5rem;
          border-radius: 24px;
          border: 1px solid var(--glass-border);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(10px);
          max-width: 450px;
          width: 100%;
        }

        h2 {
          font-size: 1.8rem;
          margin-bottom: 0.5rem;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .subtitle {
          color: var(--text-gray);
          font-size: 0.9rem;
          margin-bottom: 2rem;
        }

        .profile-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .input-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-gray);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        input, select {
          background: #1a1a1a;
          border: 1px solid #333;
          padding: 0.8rem 1rem;
          border-radius: 12px;
          color: white;
          font-size: 1rem;
          transition: all 0.3s ease;
        }

        input:focus, select:focus {
          border-color: var(--primary);
          outline: none;
          box-shadow: 0 0 10px rgba(230, 30, 42, 0.2);
        }

        .btn-primary {
          background: var(--primary);
          color: white;
          padding: 1rem;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          margin-top: 1rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .btn-primary:hover {
          background: var(--primary-hover);
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(230, 30, 42, 0.4);
        }

        .btn-primary span {
          transition: transform 0.3s ease;
        }

        .btn-primary:hover span {
          transform: translateX(4px);
        }
      `}</style>
    </div>
  );
}
