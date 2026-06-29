import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, executePurchaseTransaction, type Product } from '../db';
import { 
  Truck, 
  Plus, 
  AlertCircle,
  X,
  RefreshCcw
} from 'lucide-react';

interface PurchasesProps {
  currentUser: string;
  userRole: string;
  addToast: (msg: string, type?: 'success' | 'warning' | 'danger') => void;
}

interface PurchaseItemInput {
  product: Product;
  quantity: number;
  costPrice: number;
}

export const Purchases: React.FC<PurchasesProps> = ({ currentUser, userRole, addToast }) => {
  // Navigation states
  const [activeTab, setActiveTab] = useState<'History' | 'Suppliers'>('History');
  const [supName, setSupName] = useState<string>('');
  const [supContact, setSupContact] = useState<string>('');
  const [supPhone, setSupPhone] = useState<string>('');
  const [supEmail, setSupEmail] = useState<string>('');

  // Purchase Order Entry Modal
  const [isPOModalOpen, setIsPOModalOpen] = useState<boolean>(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number>(0);
  const [poItems, setPoItems] = useState<PurchaseItemInput[]>([]);
  const [poPaymentStatus, setPoPaymentStatus] = useState<'Paid' | 'Unpaid' | 'Partial'>('Paid');
  const [poNotes, setPoNotes] = useState<string>('');

  // Live queries
  const suppliers = useLiveQuery(() => db.suppliers.toArray());
  const purchases = useLiveQuery(() => db.purchases.orderBy('id').reverse().toArray());
  const products = useLiveQuery(() => db.products.toArray());

  // Derived low stock items list
  const lowStockItems = products?.filter(p => p.stockQuantity <= p.reorderLevel) || [];

  // Permission Checks
  const canManagePO = userRole === 'Owner' || userRole === 'Admin' || userRole === 'Inventory Staff';

  // 1. Register new supplier
  const handleRegisterSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName || !supPhone) return;

    try {
      await db.suppliers.add({
        name: supName,
        contactPerson: supContact,
        phone: supPhone,
        email: supEmail
      });

      await db.auditLogs.add({
        dateTime: new Date(),
        userId: currentUser,
        userRole,
        action: 'Register Supplier',
        details: `Registered new supplier: ${supName} (Contact: ${supContact}).`
      });

      addToast(`Supplier "${supName}" registered!`, 'success');
      setSupName('');
      setSupContact('');
      setSupPhone('');
      setSupEmail('');
    } catch (err: any) {
      addToast('Failed to register supplier.', 'danger');
    }
  };

  // 2. Automated PO generation helper
  const handleAutoSuggestPO = (supplierId: number) => {
    if (!supplierId || !products) return;
    
    // Find all low stock items linked to this supplier
    const supplierLowStock = products.filter(p => p.supplierId === supplierId && p.stockQuantity <= p.reorderLevel);
    
    if (supplierLowStock.length === 0) {
      addToast('No low stock items registered under this supplier.', 'warning');
      return;
    }

    const itemsInput: PurchaseItemInput[] = supplierLowStock.map(p => ({
      product: p,
      quantity: Math.max(10, p.reorderLevel * 2 - p.stockQuantity), // Suggest restocking double the reorder level
      costPrice: p.costPrice
    }));

    setSelectedSupplierId(supplierId);
    setPoItems(itemsInput);
    setPoPaymentStatus('Paid');
    setPoNotes(`Automated stock replenishment request.`);
    setIsPOModalOpen(true);
  };

  // Add custom manual item to active PO form
  const addManualItemToPO = (productId: number) => {
    const prod = products?.find(p => p.id === productId);
    if (!prod) return;

    // Check duplicate
    const exists = poItems.some(i => i.product.id === productId);
    if (exists) {
      addToast('Product already in the active PO draft list.', 'warning');
      return;
    }

    setPoItems(prev => [...prev, { product: prod, quantity: 10, costPrice: prod.costPrice }]);
  };

  const removePOItem = (productId: number) => {
    setPoItems(prev => prev.filter(i => i.product.id !== productId));
  };

  const updatePOItemQty = (productId: number, qty: number) => {
    setPoItems(prev => prev.map(item => item.product.id === productId ? { ...item, quantity: Math.max(1, qty) } : item));
  };

  const updatePOItemCost = (productId: number, cost: number) => {
    setPoItems(prev => prev.map(item => item.product.id === productId ? { ...item, costPrice: Math.max(0, cost) } : item));
  };

  const submitPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poItems.length === 0 || !selectedSupplierId) {
      addToast('Please select supplier and add items to purchase order.', 'warning');
      return;
    }

    const supplier = suppliers?.find(s => s.id === selectedSupplierId);
    if (!supplier) return;

    try {
      const nextPONum = `PO-${Date.now().toString().slice(-6)}`;
      
      await executePurchaseTransaction(
        nextPONum,
        selectedSupplierId,
        supplier.name,
        poItems,
        poPaymentStatus,
        poNotes,
        currentUser,
        userRole
      );

      addToast(`Restocked Successfully! ${nextPONum} recorded.`, 'success');
      setIsPOModalOpen(false);
      setPoItems([]);
      setSelectedSupplierId(0);
    } catch (err: any) {
      addToast('Error restocking inventory.', 'danger');
    }
  };

  const calculatePOTotal = () => {
    return poItems.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
  };

  return (
    <div className="content-wrapper">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Supply Chain & Purchases</h1>
          <p className="screen-subtitle">Track supplier ledgers, create purchase orders, and replenish physical stock</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {canManagePO && (
            <button className="btn btn-primary" onClick={() => {
              setPoItems([]);
              setSelectedSupplierId(0);
              setIsPOModalOpen(true);
            }}>
              <Plus size={18} />
              New Purchase Entry
            </button>
          )}
        </div>
      </div>

      {/* Low Stock Warning Dashboard alert tray */}
      {lowStockItems.length > 0 && (
        <div className="card" style={{ border: '1px solid var(--color-warning)', marginBottom: '24px', backgroundColor: 'rgba(234, 179, 8, 0.05)' }}>
          <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-warning)', fontWeight: 700 }}>
              <AlertCircle size={22} />
              Reorder Warning: {lowStockItems.length} products have fallen below reorder levels!
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Restock suggested immediately to avoid stockouts.
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', paddingBottom: '8px' }}>
        <button 
          className={`btn ${activeTab === 'History' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          onClick={() => setActiveTab('History')}
        >
          Purchase Orders History
        </button>
        <button 
          className={`btn ${activeTab === 'Suppliers' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          onClick={() => setActiveTab('Suppliers')}
        >
          Suppliers Directory
        </button>
      </div>

      {activeTab === 'History' ? (
        // Purchases History List
        <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="pos-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Supplier</th>
                  <th>Date & Time</th>
                  <th style={{ textAlign: 'right' }}>Total Cost</th>
                  <th style={{ textAlign: 'center' }}>Payment Status</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {purchases && purchases.length > 0 ? (
                  purchases.map(po => (
                    <tr key={po.id}>
                      <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{po.poNo}</td>
                      <td>{po.supplierName}</td>
                      <td>{new Date(po.dateTime).toLocaleDateString()} {new Date(po.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{po.totalAmount.toFixed(2)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${po.paymentStatus === 'Paid' ? 'badge-success' : 'badge-warning'}`}>
                          {po.paymentStatus}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-info">{po.status}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                      No purchase entries recorded. Click "New Purchase Entry" to restock.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Suppliers Directory List
        <div className="purchases-split-layout">
          {/* Supplier Directory table */}
          <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
            <div className="table-container" style={{ border: 'none' }}>
              <table className="pos-table">
                <thead>
                  <tr>
                    <th>Supplier Name</th>
                    <th>Contact Person</th>
                    <th>Phone Number</th>
                    <th>Email</th>
                    <th>Restock</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers && suppliers.length > 0 ? (
                    suppliers.map(sup => (
                      <tr key={sup.id}>
                        <td style={{ fontWeight: 600 }}>{sup.name}</td>
                        <td>{sup.contactPerson}</td>
                        <td>{sup.phone}</td>
                        <td>{sup.email || 'N/A'}</td>
                        <td>
                          {canManagePO && (
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => handleAutoSuggestPO(sup.id!)}
                            >
                              <RefreshCcw size={12} />
                              Auto PO
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                        No suppliers directory registered.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Supplier Register Form (Right) */}
          <div className="card" style={{ height: 'fit-content' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={18} style={{ color: 'var(--color-primary)' }} />
              Register Supplier Contact
            </h3>
            
            <form onSubmit={handleRegisterSupplier}>
              <div className="form-group">
                <span className="form-label">Supplier Business Name</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supreme Agencies Ltd"
                  className="form-input"
                  value={supName}
                  onChange={e => setSupName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <span className="form-label">Contact Person Name</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alok Gupta"
                  className="form-input"
                  value={supContact}
                  onChange={e => setSupContact(e.target.value)}
                />
              </div>

              <div className="form-group">
                <span className="form-label">Phone Number</span>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876500112"
                  className="form-input"
                  value={supPhone}
                  onChange={e => setSupPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <span className="form-label">Email Address (Optional)</span>
                <input
                  type="email"
                  placeholder="e.g. sales@supreme.com"
                  className="form-input"
                  value={supEmail}
                  onChange={e => setSupEmail(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                Register Supplier
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Purchase Order (PO Entry) Modal */}
      {isPOModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Record Inventory Restocking PO</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setIsPOModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitPO}>
              {/* Select Supplier */}
              <div className="form-group">
                <span className="form-label">Select Vendor Supplier</span>
                <select
                  required
                  className="form-input"
                  value={selectedSupplierId}
                  onChange={e => {
                    setSelectedSupplierId(Number(e.target.value));
                    setPoItems([]); // reset items when changing supplier
                  }}
                >
                  <option value={0}>-- Select Supplier --</option>
                  {suppliers?.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {selectedSupplierId > 0 && (
                <>
                  {/* Select product to add to PO */}
                  <div className="form-group">
                    <span className="form-label">Add Product to Draft</span>
                    <select
                      className="form-input"
                      value={0}
                      onChange={e => addManualItemToPO(Number(e.target.value))}
                    >
                      <option value={0}>-- Choose product --</option>
                      {products?.map(p => (
                        <option key={p.id} value={p.id}>{p.name} [Stock: {p.stockQuantity}]</option>
                      ))}
                    </select>
                  </div>

                  {/* PO Draft items list */}
                  <div style={{ margin: '15px 0' }}>
                    <span className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Restock Items Draft</span>
                    {poItems.length === 0 ? (
                      <div style={{ padding: '16px', border: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', borderRadius: '6px' }}>
                        No items added to draft list. Select a product above.
                      </div>
                    ) : (
                      <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        <table className="pos-table" style={{ fontSize: '0.8rem' }}>
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th style={{ width: '80px', textAlign: 'center' }}>Restock Qty</th>
                              <th style={{ width: '100px', textAlign: 'right' }}>Cost Price (₹)</th>
                              <th style={{ width: '90px', textAlign: 'right' }}>Total (₹)</th>
                              <th style={{ width: '40px', textAlign: 'center' }}>X</th>
                            </tr>
                          </thead>
                          <tbody>
                            {poItems.map((item, index) => (
                              <tr key={index}>
                                <td><strong>{item.product.name}</strong></td>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min="1"
                                    required
                                    className="form-input"
                                    style={{ width: '60px', padding: '4px', textAlign: 'center', fontSize: '0.8rem' }}
                                    value={item.quantity}
                                    onChange={e => updatePOItemQty(item.product.id!, Number(e.target.value))}
                                  />
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    required
                                    className="form-input"
                                    style={{ width: '80px', padding: '4px', textAlign: 'right', fontSize: '0.8rem' }}
                                    value={item.costPrice}
                                    onChange={e => updatePOItemCost(item.product.id!, Number(e.target.value))}
                                  />
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                  ₹{(item.costPrice * item.quantity).toFixed(2)}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}
                                    onClick={() => removePOItem(item.product.id!)}
                                  >
                                    <X size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Calculations */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '12px 16px', 
                    backgroundColor: 'var(--bg-input)', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border-color)', 
                    fontWeight: 700, 
                    marginBottom: '16px' 
                  }}>
                    <span>Estimated Purchase Cost:</span>
                    <span style={{ color: 'var(--color-primary)', fontSize: '1.15rem' }}>₹{calculatePOTotal().toFixed(2)}</span>
                  </div>

                  {/* Payment status */}
                  <div className="form-group">
                    <span className="form-label">Payment Status</span>
                    <select
                      className="form-input"
                      value={poPaymentStatus}
                      onChange={e => setPoPaymentStatus(e.target.value as any)}
                    >
                      <option value="Paid">Fully Paid (Cash Outflow)</option>
                      <option value="Unpaid">Unpaid / Bill Credit (Udhar)</option>
                      <option value="Partial">Partial / Deposit Paid</option>
                    </select>
                  </div>

                  {/* PO notes */}
                  <div className="form-group">
                    <span className="form-label">PO Remarks</span>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Regular monthly groceries supply batch"
                      value={poNotes}
                      onChange={e => setPoNotes(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsPOModalOpen(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Submit Purchase Order</button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
