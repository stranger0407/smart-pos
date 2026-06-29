import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, executeSettleCustomerDue } from '../db';
import { 
  Users, 
  Search, 
  ArrowRight,
  ArrowLeft,
  Plus,
  Coins,
  History,
  X
} from 'lucide-react';

interface LedgerProps {
  currentUser: string;
  userRole: string;
  addToast: (msg: string, type?: 'success' | 'warning' | 'danger') => void;
}

export const Ledger: React.FC<LedgerProps> = ({ currentUser, userRole, addToast }) => {
  // States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCustId, setSelectedCustId] = useState<number | null>(null);

  // Settlement Dialog
  const [isSettleModalOpen, setIsSettleModalOpen] = useState<boolean>(false);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleNotes, setSettleNotes] = useState<string>('Dues partial payment settlement');

  // Customer Management
  const [isCustModalOpen, setIsCustModalOpen] = useState<boolean>(false);
  const [custName, setCustName] = useState<string>('');
  const [custPhone, setCustPhone] = useState<string>('');
  const [custEmail, setCustEmail] = useState<string>('');
  const [custLimit, setCustLimit] = useState<number>(10000);

  // Live queries
  const customers = useLiveQuery(() => db.customers.toArray());

  // Fetch ledger history for selected customer
  const ledgerHistory = useLiveQuery(async () => {
    if (!selectedCustId) return [];
    return await db.customerLedger
      .where('customerId')
      .equals(selectedCustId)
      .sortBy('dateTime');
  }, [selectedCustId]);

  const selectedCustomer = customers?.find(c => c.id === selectedCustId);

  // Totals calculations
  const totalOutstanding = customers
    ?.filter(c => c.id !== 1) // Ignore walk-in
    ?.reduce((sum, c) => sum + c.outstandingDue, 0) || 0;

  const totalDuesCount = customers
    ?.filter(c => c.id !== 1 && c.outstandingDue > 0)
    ?.length || 0;

  // Filter customers list
  const filteredCustomers = customers?.filter(c => {
    if (c.id === 1) return false; // Ignore Walk-in in ledger list
    return c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery);
  });

  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone) return;

    try {
      const newId = await db.customers.add({
        name: custName,
        phone: custPhone,
        email: custEmail,
        outstandingDue: 0,
        creditLimit: custLimit
      });

      await db.auditLogs.add({
        dateTime: new Date(),
        userId: currentUser,
        userRole,
        action: 'Register Customer',
        details: `Registered customer ${custName} with credit limit ₹${custLimit}`
      });

      addToast(`Customer "${custName}" registered successfully!`, 'success');
      setIsCustModalOpen(false);
      setCustName('');
      setCustPhone('');
      setCustEmail('');
      setSelectedCustId(newId);
    } catch (err: any) {
      addToast('Error registering customer.', 'danger');
    }
  };

  const handleSettleDues = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustId || !selectedCustomer || settleAmount <= 0) return;

    if (settleAmount > selectedCustomer.outstandingDue) {
      addToast(`Settlement amount (₹${settleAmount}) exceeds outstanding due (₹${selectedCustomer.outstandingDue})!`, 'warning');
      return;
    }

    try {
      await executeSettleCustomerDue(
        selectedCustId,
        settleAmount,
        settleNotes,
        currentUser,
        userRole
      );
      
      addToast(`Payment of ₹${settleAmount} recorded. Outstanding dues updated.`, 'success');
      setIsSettleModalOpen(false);
      setSettleAmount(0);
    } catch (err: any) {
      addToast(err.message || 'Error settling dues.', 'danger');
    }
  };

  const canEditLimit = userRole === 'Owner' || userRole === 'Admin';

  const updateCreditLimit = async (limit: number) => {
    if (!selectedCustId) return;
    try {
      await db.customers.update(selectedCustId, { creditLimit: limit });
      await db.auditLogs.add({
        dateTime: new Date(),
        userId: currentUser,
        userRole,
        action: 'Update Credit Limit',
        details: `Updated credit limit for ${selectedCustomer?.name} to ₹${limit}.`
      });
      addToast(`Credit limit updated to ₹${limit}`, 'success');
    } catch (err: any) {
      addToast('Failed to update credit limit.', 'danger');
    }
  };

  return (
    <div className="content-wrapper">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Customer Udhar & Ledger</h1>
          <p className="screen-subtitle">Manage customer store credit, khata book accounts, and outstanding dues</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsCustModalOpen(true)}>
          <Plus size={18} />
          Register New Account
        </button>
      </div>

      {/* Ledger Overview Cards */}
      <div className="ledger-overview-grid">
        
        {/* Outstanding statistics card */}
        <div className="kpi-card" style={{ height: 'fit-content' }}>
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(244, 63, 94, 0.15)', color: 'var(--color-danger)' }}>
            <Coins size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-title">Total Outstanding Dues</span>
            <span className="kpi-value" style={{ color: 'var(--color-danger)' }}>₹{totalOutstanding.toLocaleString('en-IN')}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Outstanding accounts: <strong>{totalDuesCount}</strong>
            </span>
          </div>
        </div>

        {/* Search bar */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px' }}>
          <Search size={22} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search accounts by customer name or phone number..."
            className="form-input"
            style={{ fontSize: '0.95rem' }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

      </div>

      {/* Ledger Split Layout */}
      <div className={`ledger-split-layout ${selectedCustId ? 'details-active' : ''}`}>
        
        {/* Customers list (Left) */}
        <div className="card customer-list-panel" style={{ padding: '0px', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>
            Customer Accounts Directory
          </div>
          <div className="table-container" style={{ border: 'none', borderRadius: '0px' }}>
            <table className="pos-table">
              <thead>
                <tr>
                  <th>Customer Profile</th>
                  <th style={{ textAlign: 'right' }}>Credit Limit</th>
                  <th style={{ textAlign: 'right' }}>Outstanding</th>
                  <th style={{ textAlign: 'center' }}>Ledger</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers && filteredCustomers.length > 0 ? (
                  filteredCustomers.map(cust => (
                    <tr 
                      key={cust.id} 
                      style={{ cursor: 'pointer', backgroundColor: selectedCustId === cust.id ? 'var(--bg-card-hover)' : 'inherit' }}
                      onClick={() => setSelectedCustId(cust.id!)}
                    >
                      <td>
                        <div style={{ fontWeight: 600 }}>{cust.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cust.phone}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>₹{cust.creditLimit.toLocaleString('en-IN')}</td>
                      <td style={{ 
                        textAlign: 'right', 
                        fontWeight: 700, 
                        color: cust.outstandingDue > 0 ? 'var(--color-danger)' : 'var(--color-success)' 
                      }}>
                        ₹{cust.outstandingDue.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <ArrowRight size={16} style={{ color: selectedCustId === cust.id ? 'var(--color-primary)' : 'var(--text-muted)' }} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                      No customer accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer Ledger History (Right) */}
        <div className="card customer-details-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          {selectedCustomer ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              {/* Mobile Back Button */}
              <button 
                className="btn btn-secondary mobile-only" 
                style={{ width: 'fit-content', marginBottom: '16px', gap: '6px', padding: '8px 12px', fontSize: '0.8rem' }} 
                onClick={() => setSelectedCustId(null)}
              >
                <ArrowLeft size={16} />
                Back to Directory
              </button>
              
              {/* Header profile */}
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selectedCustomer.name}</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tel: {selectedCustomer.phone} | {selectedCustomer.email || 'No Email'}</span>
                </div>
                {selectedCustomer.outstandingDue > 0 && (
                  <button 
                    className="btn btn-success" 
                    style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                    onClick={() => {
                      setSettleAmount(selectedCustomer.outstandingDue);
                      setIsSettleModalOpen(true);
                    }}
                  >
                    <Coins size={16} />
                    Settle Payment
                  </button>
                )}
              </div>

              {/* Account summary values */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div style={{ backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Outstanding Balance</div>
                  <strong style={{ fontSize: '1.25rem', color: selectedCustomer.outstandingDue > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    ₹{selectedCustomer.outstandingDue.toLocaleString('en-IN')}
                  </strong>
                </div>

                <div style={{ backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Available Credit Limit</div>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                    <strong style={{ fontSize: '1.15rem' }}>
                      ₹{(selectedCustomer.creditLimit - selectedCustomer.outstandingDue).toLocaleString('en-IN')}
                    </strong>
                    {canEditLimit ? (
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '80px', padding: '2px 4px', fontSize: '0.75rem', textAlign: 'right' }}
                        defaultValue={selectedCustomer.creditLimit}
                        onBlur={e => updateCreditLimit(Number(e.target.value))}
                        title="Press tab or click away to update limit"
                      />
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Max: ₹{selectedCustomer.creditLimit}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* History Timeline */}
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <History size={16} />
                  Ledger Transaction History
                </h4>
                
                <div className="table-container" style={{ flexGrow: 1, maxHeight: '280px', overflowY: 'auto' }}>
                  <table className="pos-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Type</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                        <th style={{ textAlign: 'right' }}>Balance</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerHistory && ledgerHistory.length > 0 ? (
                        ledgerHistory.map(entry => {
                          const isSale = entry.type === 'Sale';
                          return (
                            <tr key={entry.id}>
                              <td>{new Date(entry.dateTime).toLocaleDateString()} {new Date(entry.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td>
                                <span className={`badge ${isSale ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.6rem', padding: '1px 4px' }}>
                                  {entry.type}
                                </span>
                              </td>
                              <td style={{ 
                                textAlign: 'right', 
                                fontWeight: 700, 
                                color: entry.amount > 0 ? 'var(--color-danger)' : 'var(--color-success)' 
                              }}>
                                {entry.amount > 0 ? '+' : ''}₹{entry.amount.toFixed(2)}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{entry.balance.toFixed(2)}</td>
                              <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{entry.notes}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                            No history records.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '12px', padding: '60px 0' }}>
              <Users size={48} strokeWidth={1} />
              <span>Select a customer account to view ledger history</span>
            </div>
          )}
        </div>

      </div>

      {/* Settle Due Payment Dialog Modal */}
      {isSettleModalOpen && selectedCustomer && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Record Cash/UPI Due Settlement</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setIsSettleModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSettleDues}>
              <div style={{ marginBottom: '16px', backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                <div>Customer Account: <strong>{selectedCustomer.name}</strong></div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-danger)', fontWeight: 600, marginTop: '4px' }}>
                  Total Outstanding Dues: ₹{selectedCustomer.outstandingDue.toFixed(2)}
                </div>
              </div>

              <div className="form-group">
                <span className="form-label">Payment Amount Received (₹)</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  className="form-input"
                  value={settleAmount}
                  onChange={e => setSettleAmount(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <span className="form-label">Remarks / Ledger Notes</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Settle partial invoice #INV-10001"
                  className="form-input"
                  value={settleNotes}
                  onChange={e => setSettleNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsSettleModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-success" style={{ flexGrow: 1 }}>Settle Dues</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Customer Register Modal */}
      {isCustModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Register Customer Credit Account</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setIsCustModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleRegisterCustomer}>
              <div className="form-group">
                <span className="form-label">Customer Name</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amit Verma"
                  className="form-input"
                  value={custName}
                  onChange={e => setCustName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <span className="form-label">Mobile Number</span>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9988776655"
                  className="form-input"
                  value={custPhone}
                  onChange={e => setCustPhone(e.target.value)}
                />
              </div>
              <div className="form-group">
                <span className="form-label">Email Address (Optional)</span>
                <input
                  type="email"
                  placeholder="e.g. amit@outlook.com"
                  className="form-input"
                  value={custEmail}
                  onChange={e => setCustEmail(e.target.value)}
                />
              </div>
              <div className="form-group">
                <span className="form-label">Credit Limit (₹)</span>
                <input
                  type="number"
                  required
                  placeholder="e.g. 15000"
                  className="form-input"
                  value={custLimit}
                  onChange={e => setCustLimit(Number(e.target.value))}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsCustModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Register Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
