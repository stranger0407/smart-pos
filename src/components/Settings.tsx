import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedDatabase } from '../db';
import { 
  Settings as SettingsIcon, 
  Download, 
  Upload, 
  FileText,
  Save,
  RotateCcw,
  ShieldCheck
} from 'lucide-react';

interface SettingsProps {
  currentUser: string;
  userRole: string;
  addToast: (msg: string, type?: 'success' | 'warning' | 'danger') => void;
}

export const Settings: React.FC<SettingsProps> = ({ currentUser, userRole, addToast }) => {
  // Store details state
  const [storeName, setStoreName] = useState<string>('Smart POS Stores');
  const [storeAddress, setStoreAddress] = useState<string>('12, Market Square, Connaught Place, New Delhi');
  const [storePhone, setStorePhone] = useState<string>('9876543210');
  const [storeGstin, setStoreGstin] = useState<string>('07AAAAA1111A1Z1');

  // Permission Checks
  const isOwner = userRole === 'Owner';

  // Load from local storage
  useEffect(() => {
    const savedName = localStorage.getItem('smart_pos_store_name');
    const savedAddress = localStorage.getItem('smart_pos_store_address');
    const savedPhone = localStorage.getItem('smart_pos_store_phone');
    const savedGstin = localStorage.getItem('smart_pos_store_gstin');

    if (savedName) setStoreName(savedName);
    if (savedAddress) setStoreAddress(savedAddress);
    if (savedPhone) setStorePhone(savedPhone);
    if (savedGstin) setStoreGstin(savedGstin);
  }, []);

  // Fetch all audit logs
  const auditLogs = useLiveQuery(() => db.auditLogs.orderBy('dateTime').reverse().toArray());

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName || !storeAddress || !storePhone || !storeGstin) {
      addToast('Please fill out all store profile details.', 'warning');
      return;
    }

    localStorage.setItem('smart_pos_store_name', storeName);
    localStorage.setItem('smart_pos_store_address', storeAddress);
    localStorage.setItem('smart_pos_store_phone', storePhone);
    localStorage.setItem('smart_pos_store_gstin', storeGstin);

    db.auditLogs.add({
      dateTime: new Date(),
      userId: currentUser,
      userRole,
      action: 'Update Store Settings',
      details: `Updated store header details. Name: ${storeName}, GSTIN: ${storeGstin}`
    });

    addToast('Store profile details updated successfully!', 'success');
  };

  // 1. Export database to JSON
  const handleExportDB = async () => {
    try {
      const data: { [key: string]: any[] } = {};
      
      data.products = await db.products.toArray();
      data.customers = await db.customers.toArray();
      data.suppliers = await db.suppliers.toArray();
      data.sales = await db.sales.toArray();
      data.saleItems = await db.saleItems.toArray();
      data.purchases = await db.purchases.toArray();
      data.purchaseItems = await db.purchaseItems.toArray();
      data.customerLedger = await db.customerLedger.toArray();
      data.supplierLedger = await db.supplierLedger.toArray();
      data.cashDrawer = await db.cashDrawer.toArray();
      data.auditLogs = await db.auditLogs.toArray();

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `smart_pos_backup_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await db.auditLogs.add({
        dateTime: new Date(),
        userId: currentUser,
        userRole,
        action: 'Backup Export',
        details: 'Exported a full JSON database backup file.'
      });

      addToast('Database backup downloaded successfully!', 'success');
    } catch (err: any) {
      addToast('Backup export failed.', 'danger');
    }
  };

  // 2. Import database from JSON
  const handleImportDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isOwner) {
      addToast('Only store Owners can import/restore databases!', 'danger');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        // Confirm valid payload structure
        if (!data.products || !data.sales || !data.customers) {
          addToast('Invalid backup file format.', 'danger');
          return;
        }

        // Clear and reload
        await db.transaction('rw', [
          db.products, db.customers, db.suppliers, db.sales, db.saleItems, 
          db.purchases, db.purchaseItems, db.customerLedger, db.supplierLedger,
          db.cashDrawer, db.auditLogs
        ], async () => {
          await db.products.clear();
          await db.customers.clear();
          await db.suppliers.clear();
          await db.sales.clear();
          await db.saleItems.clear();
          await db.purchases.clear();
          await db.purchaseItems.clear();
          await db.customerLedger.clear();
          await db.supplierLedger.clear();
          await db.cashDrawer.clear();
          await db.auditLogs.clear();

          if (data.products.length) await db.products.bulkAdd(data.products);
          if (data.customers.length) await db.customers.bulkAdd(data.customers);
          if (data.suppliers.length) await db.suppliers.bulkAdd(data.suppliers);
          if (data.sales.length) await db.sales.bulkAdd(data.sales);
          if (data.saleItems.length) await db.saleItems.bulkAdd(data.saleItems);
          if (data.purchases.length) await db.purchases.bulkAdd(data.purchases);
          if (data.purchaseItems.length) await db.purchaseItems.bulkAdd(data.purchaseItems);
          if (data.customerLedger.length) await db.customerLedger.bulkAdd(data.customerLedger);
          if (data.supplierLedger.length) await db.supplierLedger.bulkAdd(data.supplierLedger);
          if (data.cashDrawer.length) await db.cashDrawer.bulkAdd(data.cashDrawer);
          if (data.auditLogs.length) await db.auditLogs.bulkAdd(data.auditLogs);
        });

        await db.auditLogs.add({
          dateTime: new Date(),
          userId: currentUser,
          userRole,
          action: 'Backup Restore',
          details: `Imported database state from backup file: ${file.name}`
        });

        addToast('Database restored successfully! Reloading data...', 'success');
        setTimeout(() => window.location.reload(), 1500);
      } catch (err: any) {
        addToast('Failed to parse database file.', 'danger');
      }
    };
    reader.readAsText(file);
  };

  const handleResetDemoData = async () => {
    if (!isOwner) {
      addToast('Only store Owners can reset data!', 'danger');
      return;
    }

    if (window.confirm('WARNING: This will delete ALL transactions, customer dues, and custom products, and reload the default seed dataset. Are you sure?')) {
      try {
        await db.transaction('rw', [
          db.products, db.customers, db.suppliers, db.sales, db.saleItems, 
          db.purchases, db.purchaseItems, db.customerLedger, db.supplierLedger,
          db.cashDrawer, db.auditLogs
        ], async () => {
          await db.products.clear();
          await db.customers.clear();
          await db.suppliers.clear();
          await db.sales.clear();
          await db.saleItems.clear();
          await db.purchases.clear();
          await db.purchaseItems.clear();
          await db.customerLedger.clear();
          await db.supplierLedger.clear();
          await db.cashDrawer.clear();
          await db.auditLogs.clear();
        });
        await seedDatabase();
        addToast('Database reset and seed dataset loaded!', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } catch (err) {
        addToast('Failed to reset database.', 'danger');
      }
    }
  };

  return (
    <div className="content-wrapper">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">System Settings</h1>
          <p className="screen-subtitle">Configure store headers, download database backups, and inspect security logs</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        
        {/* Left: Store profile & Backup */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Store Profile settings */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SettingsIcon size={18} style={{ color: 'var(--color-primary)' }} />
              Retail Shop Print Headers
            </h3>
            
            <form onSubmit={handleSaveProfile}>
              <div className="form-group">
                <span className="form-label">Store Business Name</span>
                <input
                  type="text"
                  required
                  disabled={!isOwner}
                  className="form-input"
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <span className="form-label">Shop Address</span>
                <input
                  type="text"
                  required
                  disabled={!isOwner}
                  className="form-input"
                  value={storeAddress}
                  onChange={e => setStoreAddress(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <span className="form-label">Store Contact Mobile</span>
                  <input
                    type="tel"
                    required
                    disabled={!isOwner}
                    className="form-input"
                    value={storePhone}
                    onChange={e => setStorePhone(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <span className="form-label">Shop GSTIN Code</span>
                  <input
                    type="text"
                    required
                    disabled={!isOwner}
                    className="form-input"
                    value={storeGstin}
                    onChange={e => setStoreGstin(e.target.value)}
                  />
                </div>
              </div>

              {isOwner && (
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                  <Save size={18} />
                  Save Store Headers
                </button>
              )}
            </form>
          </div>

          {/* Database Backup Section */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} style={{ color: 'var(--color-success)' }} />
              Database Backups & Cloud Sync Recovery
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Since Smart POS is local-first, all data is securely stored on this device. Download JSON backups to sync or migrate to another terminal.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="btn btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center' }} onClick={handleExportDB}>
                <Download size={18} />
                Export Database JSON Backup
              </button>

              <div style={{ border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.8rem', display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                  Restore database from JSON file
                </span>
                <label className="btn btn-secondary" style={{ display: 'inline-flex', cursor: isOwner ? 'pointer' : 'not-allowed', width: '80%' }}>
                  <Upload size={18} />
                  Upload Backup JSON
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    disabled={!isOwner}
                    onChange={handleImportDB}
                  />
                </label>
              </div>

              {isOwner && (
                <button className="btn btn-danger" style={{ width: '100%', marginTop: '12px', display: 'flex', justifyContent: 'center' }} onClick={handleResetDemoData}>
                  <RotateCcw size={18} />
                  Reset Database & Load Seed Dataset
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Right: Security Audit Logs */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} style={{ color: 'var(--color-info)' }} />
            Security Activity Audit Trails
          </h3>
          
          <div className="table-container" style={{ flexGrow: 1, maxHeight: '520px', overflowY: 'auto' }}>
            <table className="pos-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>Operator</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs && auditLogs.length > 0 ? (
                  auditLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(log.dateTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{log.action}</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.details}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{log.userId.split(' ')[0]}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-success)' }}>{log.userRole}</div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                      No audit activities logged.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
