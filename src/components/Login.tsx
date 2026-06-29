import React, { useState, useEffect } from 'react';
import { ShieldCheck, Delete, ArrowRightLeft } from 'lucide-react';
import { db } from '../db';

interface LoginProps {
  onLogin: (role: string, username: string) => void;
}

const DEFAULT_USERS = [
  { pin: '1111', role: 'Owner', name: 'Alok Nath (Owner)' },
  { pin: '2222', role: 'Admin', name: 'Ravi Kumar (Admin)' },
  { pin: '3333', role: 'Cashier', name: 'Neha Singh (Cashier)' },
  { pin: '4444', role: 'Inventory Staff', name: 'Vikram Dev (Inventory)' },
  { pin: '5555', role: 'Accountant', name: 'Sonia Iyer (Accountant)' },
];

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Handle Keyboard Inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin]);

  const handleDigit = (digit: string) => {
    setError('');
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const verifyPin = async (inputPin: string) => {
    const matchedUser = DEFAULT_USERS.find(u => u.pin === inputPin);
    if (matchedUser) {
      // Log audit trail
      await db.auditLogs.add({
        dateTime: new Date(),
        userId: matchedUser.name,
        userRole: matchedUser.role,
        action: 'User Login',
        details: `Successfully logged in via POS numeric terminal.`,
      });
      // Delay slightly for visual effect
      setTimeout(() => {
        onLogin(matchedUser.role, matchedUser.name);
      }, 300);
    } else {
      setError('Invalid Passcode. Please try again.');
      setPin('');
      // Log failed audit trail
      await db.auditLogs.add({
        dateTime: new Date(),
        userId: 'Unknown',
        userRole: 'None',
        action: 'Failed Login Attempt',
        details: `Attempted login with invalid PIN prefix: ${inputPin.slice(0, 2)}**`,
      });
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100%',
      background: 'radial-gradient(circle at center, #241c19 0%, #0c0a09 100%)',
      padding: '20px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <div style={{
          width: '45px',
          height: '45px',
          background: 'linear-gradient(135deg, var(--color-primary), #ea580c)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          boxShadow: '0 0 25px rgba(249,115,22,0.4)'
        }}>
          <ShieldCheck size={28} />
        </div>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 800,
          background: 'linear-gradient(to right, #ffffff, #a8a29e)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>Smart POS</h1>
      </div>

      <div className="pin-pad-container">
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>Terminal Passcode</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Enter your 4-digit security PIN to log in</p>
        </div>

        <div className="pin-display">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} style={{
              display: 'inline-block',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: pin.length > i ? 'var(--color-primary)' : 'var(--border-color)',
              margin: '0 8px',
              transition: 'var(--transition-smooth)',
              boxShadow: pin.length > i ? '0 0 10px var(--color-primary)' : 'none'
            }} />
          ))}
        </div>

        {error && (
          <p style={{
            color: 'var(--color-danger)',
            fontSize: '0.85rem',
            textAlign: 'center',
            fontWeight: 600
          }}>{error}</p>
        )}

        <div className="pin-grid">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              className="pin-btn"
              onClick={() => handleDigit(num)}
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            className="pin-btn"
            style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}
            onClick={handleClear}
          >
            CLEAR
          </button>
          <button
            type="button"
            className="pin-btn"
            onClick={() => handleDigit('0')}
          >
            0
          </button>
          <button
            type="button"
            className="pin-btn"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={handleBackspace}
          >
            <Delete size={22} />
          </button>
        </div>
      </div>

      {/* Admin Demo Helper */}
      <div style={{
        marginTop: '30px',
        backgroundColor: 'rgba(28, 25, 23, 0.6)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '16px 20px',
        maxWidth: '380px',
        width: '100%',
        boxShadow: 'var(--shadow-premium)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '10px',
          color: 'var(--color-primary)',
          fontSize: '0.85rem',
          fontWeight: 700,
          textTransform: 'uppercase'
        }}>
          <ArrowRightLeft size={16} />
          <span>Demo PIN Directory</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 15px' }}>
          {DEFAULT_USERS.map(u => (
            <div key={u.pin} style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.role}</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                PIN: <strong style={{ color: 'var(--color-primary)' }}>{u.pin}</strong>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
