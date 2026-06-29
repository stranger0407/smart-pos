import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Product } from '../db';
import { 
  Plus, 
  Edit, 
  ArrowUpDown, 
  X,
  Search
} from 'lucide-react';

interface InventoryProps {
  currentUser: string;
  userRole: string;
  addToast: (msg: string, type?: 'success' | 'warning' | 'danger') => void;
}

export const Inventory: React.FC<InventoryProps> = ({ currentUser, userRole, addToast }) => {
  // States
  const [filterMode, setFilterMode] = useState<'All' | 'Low' | 'Out'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState<boolean>(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'In' | 'Out'>('In');
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('Stock Count Correction');

  // Product Form Fields
  const [prodName, setProdName] = useState<string>('');
  const [prodBarcode, setProdBarcode] = useState<string>('');
  const [prodSku, setProdSku] = useState<string>('');
  const [prodCat, setProdCat] = useState<string>('Groceries');
  const [prodCost, setProdCost] = useState<number>(0);
  const [prodSell, setProdSell] = useState<number>(0);
  const [prodTax, setProdTax] = useState<number>(18);
  const [prodStock, setProdStock] = useState<number>(0);
  const [prodReorder, setProdReorder] = useState<number>(5);
  const [prodSupplierId, setProdSupplierId] = useState<number>(0);

  // Live queries
  const products = useLiveQuery(() => db.products.toArray());
  const suppliers = useLiveQuery(() => db.suppliers.toArray());

  // Permission Checks
  const canEditProduct = userRole === 'Owner' || userRole === 'Admin';
  const canAdjustStock = userRole === 'Owner' || userRole === 'Admin' || userRole === 'Inventory Staff';

  const resetProductForm = () => {
    setProdName('');
    setProdBarcode('');
    setProdSku('');
    setProdCat('Groceries');
    setProdCost(0);
    setProdSell(0);
    setProdTax(18);
    setProdStock(0);
    setProdReorder(5);
    setProdSupplierId(0);
    setEditingProduct(null);
  };

  const openAddModal = () => {
    resetProductForm();
    setIsProductModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setProdName(prod.name);
    setProdBarcode(prod.barcode);
    setProdSku(prod.sku);
    setProdCat(prod.category);
    setProdCost(prod.costPrice);
    setProdSell(prod.sellingPrice);
    setProdTax(prod.taxRate);
    setProdStock(prod.stockQuantity);
    setProdReorder(prod.reorderLevel);
    setProdSupplierId(prod.supplierId || 0);
    setIsProductModalOpen(true);
  };

  const openAdjustModal = (prod: Product) => {
    setAdjustingProduct(prod);
    setAdjustQty(1);
    setAdjustType('In');
    setAdjustReason('Stock Count Correction');
    setIsAdjustmentModalOpen(true);
  };

  // Submit product creation/editing
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName || !prodBarcode || !prodSku) return;

    try {
      const productPayload: Product = {
        name: prodName,
        barcode: prodBarcode,
        sku: prodSku,
        category: prodCat,
        costPrice: Number(prodCost),
        sellingPrice: Number(prodSell),
        taxRate: Number(prodTax),
        stockQuantity: Number(prodStock),
        reorderLevel: Number(prodReorder),
        supplierId: prodSupplierId > 0 ? prodSupplierId : undefined,
      };

      if (editingProduct) {
        // Edit Mode
        await db.products.update(editingProduct.id!, productPayload);
        await db.auditLogs.add({
          dateTime: new Date(),
          userId: currentUser,
          userRole,
          action: 'Modify Product',
          details: `Modified product: ${prodName} (SKU: ${prodSku}). Updated price to ₹${prodSell}.`
        });
        addToast(`Product "${prodName}" updated!`, 'success');
      } else {
        // Add Mode
        // Check duplicate barcode
        const existing = products?.find(p => p.barcode === prodBarcode);
        if (existing) {
          addToast(`Product with Barcode ${prodBarcode} already exists!`, 'danger');
          return;
        }

        await db.products.add(productPayload);
        await db.auditLogs.add({
          dateTime: new Date(),
          userId: currentUser,
          userRole,
          action: 'Add Product',
          details: `Added new product: ${prodName} (SKU: ${prodSku}). Initial stock: ${prodStock}.`
        });
        addToast(`Product "${prodName}" registered!`, 'success');
      }
      setIsProductModalOpen(false);
      resetProductForm();
    } catch (err: any) {
      addToast('Error saving product.', 'danger');
    }
  };

  // Submit stock adjustments
  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    try {
      const quantityDiff = adjustType === 'In' ? adjustQty : -adjustQty;
      const newStock = adjustingProduct.stockQuantity + quantityDiff;

      if (newStock < 0) {
        addToast('Stock quantity cannot go below 0!', 'danger');
        return;
      }

      await db.products.update(adjustingProduct.id!, { stockQuantity: newStock });
      
      await db.auditLogs.add({
        dateTime: new Date(),
        userId: currentUser,
        userRole,
        action: 'Manual Stock Adjustment',
        details: `Adjusted stock for ${adjustingProduct.name}. Type: Stock ${adjustType}, Qty: ${adjustQty}, Reason: ${adjustReason}. New stock: ${newStock}.`
      });

      addToast(`Stock for "${adjustingProduct.name}" adjusted successfully.`, 'success');
      setIsAdjustmentModalOpen(false);
      setAdjustingProduct(null);
    } catch (err: any) {
      addToast('Error adjusting stock.', 'danger');
    }
  };

  // Filtered List calculations
  const filteredProducts = products?.filter(prod => {
    // 1. Category Search
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          prod.barcode.includes(searchQuery) ||
                          prod.sku.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    // 2. Alert filters
    if (filterMode === 'Low') {
      return prod.stockQuantity <= prod.reorderLevel && prod.stockQuantity > 0;
    }
    if (filterMode === 'Out') {
      return prod.stockQuantity === 0;
    }
    return true;
  });

  return (
    <div className="content-wrapper">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Physical Inventory</h1>
          <p className="screen-subtitle">Track, edit, and adjust your real-time catalog stock levels</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {canEditProduct && (
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={18} />
              Register New Product
            </button>
          )}
        </div>
      </div>

      {/* Filter Options & Search */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['All', 'Low', 'Out'] as const).map(mode => {
            const isActive = filterMode === mode;
            let label = 'All Items';
            if (mode === 'Low') label = 'Low Stock Alerts';
            if (mode === 'Out') label = 'Out of Stock';

            return (
              <button
                key={mode}
                className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                onClick={() => setFilterMode(mode)}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '300px' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} size={18} />
          <input
            type="text"
            placeholder="Search by name, barcode..."
            className="form-input"
            style={{ paddingLeft: '38px', paddingRight: '12px', height: '38px', fontSize: '0.875rem' }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Inventory table */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        <div className="table-container">
          <table className="pos-table">
            <thead>
              <tr>
                <th>Product Details</th>
                <th>SKU & Barcode</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Cost</th>
                <th style={{ textAlign: 'right' }}>Selling Price</th>
                <th style={{ textAlign: 'center' }}>Tax</th>
                <th style={{ textAlign: 'center' }}>Stock Level</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts && filteredProducts.length > 0 ? (
                filteredProducts.map(prod => {
                  const isLow = prod.stockQuantity <= prod.reorderLevel && prod.stockQuantity > 0;
                  const isOut = prod.stockQuantity === 0;

                  let badgeClass = 'badge-success';
                  let statusText = 'Normal';
                  if (isLow) {
                    badgeClass = 'badge-warning';
                    statusText = 'Low Stock';
                  } else if (isOut) {
                    badgeClass = 'badge-danger';
                    statusText = 'Out of Stock';
                  }

                  return (
                    <tr key={prod.id}>
                      <td style={{ fontWeight: 600 }}>{prod.name}</td>
                      <td>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>SKU: {prod.sku}</div>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '2px' }}>
                          BC: {prod.barcode}
                        </div>
                      </td>
                      <td>{prod.category}</td>
                      <td style={{ textAlign: 'right' }}>₹{prod.costPrice.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                        ₹{prod.sellingPrice.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center' }}>{prod.taxRate}% GST</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontWeight: 800, fontSize: '1rem' }}>{prod.stockQuantity}</span>
                          <span className={`badge ${badgeClass}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                            {statusText}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          {canAdjustStock && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                              onClick={() => openAdjustModal(prod)}
                            >
                              <ArrowUpDown size={14} />
                              Adjust
                            </button>
                          )}
                          {canEditProduct && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                              onClick={() => openEditModal(prod)}
                            >
                              <Edit size={14} />
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    No products matched search query/filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isProductModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Register New Product'}
              </h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setIsProductModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleProductSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <span className="form-label">Product Name</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fortune Mustard Oil (1L)"
                    className="form-input"
                    value={prodName}
                    onChange={e => setProdName(e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <span className="form-label">SKU Code</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GROC-OIL-009"
                    className="form-input"
                    value={prodSku}
                    onChange={e => setProdSku(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <span className="form-label">Barcode EAN</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 8901234567890"
                    className="form-input"
                    value={prodBarcode}
                    onChange={e => setProdBarcode(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <span className="form-label">Category</span>
                  <select className="form-input" value={prodCat} onChange={e => setProdCat(e.target.value)}>
                    <option value="Groceries">Groceries</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Personal Care">Personal Care</option>
                    <option value="Snacks">Snacks</option>
                    <option value="Apparel">Apparel</option>
                  </select>
                </div>

                <div className="form-group">
                  <span className="form-label">Associated Supplier</span>
                  <select className="form-input" value={prodSupplierId} onChange={e => setProdSupplierId(Number(e.target.value))}>
                    <option value={0}>None / Open Purchase</option>
                    {suppliers?.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <span className="form-label">Cost Price (₹)</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="form-input"
                    value={prodCost}
                    onChange={e => setProdCost(Number(e.target.value))}
                  />
                </div>

                <div className="form-group">
                  <span className="form-label">Selling Price (₹)</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="form-input"
                    value={prodSell}
                    onChange={e => setProdSell(Number(e.target.value))}
                  />
                </div>

                <div className="form-group">
                  <span className="form-label">GST Tax Rate (%)</span>
                  <select className="form-input" value={prodTax} onChange={e => setProdTax(Number(e.target.value))}>
                    <option value={0}>0% (Tax Exempt)</option>
                    <option value={5}>5% (Essential Goods)</option>
                    <option value={12}>12% (Standard)</option>
                    <option value={18}>18% (Standard Services/Goods)</option>
                    <option value={28}>28% (Luxury)</option>
                  </select>
                </div>

                <div className="form-group">
                  <span className="form-label">Initial Stock Quantity</span>
                  <input
                    type="number"
                    required
                    disabled={editingProduct !== null} // Cannot manual set here in edit mode - use Stock Adjust instead!
                    className="form-input"
                    value={prodStock}
                    onChange={e => setProdStock(Number(e.target.value))}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <span className="form-label">Low Stock Reorder Threshold level</span>
                  <input
                    type="number"
                    required
                    className="form-input"
                    value={prodReorder}
                    onChange={e => setProdReorder(Number(e.target.value))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsProductModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Dialog Modal */}
      {isAdjustmentModalOpen && adjustingProduct && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Manual Stock Adjustment</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setIsAdjustmentModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ marginBottom: '16px', backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
              <div>Product: <strong>{adjustingProduct.name}</strong></div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Current Stock: {adjustingProduct.stockQuantity}</div>
            </div>

            <form onSubmit={handleAdjustmentSubmit}>
              <div className="form-group">
                <span className="form-label">Adjustment Flow</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className={`btn ${adjustType === 'In' ? 'btn-success' : 'btn-secondary'}`}
                    style={{ flexGrow: 1 }}
                    onClick={() => setAdjustType('In')}
                  >Stock In (Add)</button>
                  <button
                    type="button"
                    className={`btn ${adjustType === 'Out' ? 'btn-danger' : 'btn-secondary'}`}
                    style={{ flexGrow: 1 }}
                    onClick={() => setAdjustType('Out')}
                  >Stock Out (Reduce)</button>
                </div>
              </div>

              <div className="form-group">
                <span className="form-label">Adjustment Quantity</span>
                <input
                  type="number"
                  min="1"
                  required
                  className="form-input"
                  value={adjustQty}
                  onChange={e => setAdjustQty(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <span className="form-label">Reason for Change</span>
                <select className="form-input" value={adjustReason} onChange={e => setAdjustReason(e.target.value)}>
                  <option value="Stock Count Correction">Stock Count Correction (Audit)</option>
                  <option value="Damaged Goods">Damaged Goods (Writedown)</option>
                  <option value="Customer Return">Customer Return</option>
                  <option value="Expiry Check">Expired stock clearance</option>
                  <option value="Restocking">Manual Restocking</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsAdjustmentModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Save Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
