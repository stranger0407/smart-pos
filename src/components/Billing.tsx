import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, executeSaleTransaction, type Product } from '../db';
import { 
  Search, 
  Barcode, 
  Trash2, 
  Pause, 
  Play, 
  Printer, 
  Share2, 
  CheckCircle,
  UserPlus, 
  ShoppingBag,
  X
} from 'lucide-react';

interface BillingProps {
  currentUser: string;
  userRole: string;
  addToast: (msg: string, type?: 'success' | 'warning' | 'danger') => void;
}

interface CartItem {
  product: Product;
  quantity: number;
  discount: number; // Discount in rupees per item
}

interface HeldCart {
  id: string;
  dateTime: Date;
  customerId: number;
  customerName: string;
  items: CartItem[];
}

export const Billing: React.FC<BillingProps> = ({ currentUser, userRole, addToast }) => {
  // States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [barcodeQuery, setBarcodeQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(1); // Walk-in is 1 by default
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Card' | 'UPI' | 'Credit' | 'Split'>('Cash');
  
  // Split payment amounts
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [upiAmount, setUpiAmount] = useState<number>(0);

  // Dues & limits check for Credit mode
  const [creditAvailable, setCreditAvailable] = useState<number>(0);

  // Held Bills
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  
  // Checkout & Invoice Preview States
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [invoiceNo, setInvoiceNo] = useState<string>('');
  const [invoiceMode, setInvoiceMode] = useState<'thermal' | 'a4'>('thermal');

  // Customer quick add states
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustPhone, setNewCustPhone] = useState<string>('');
  const [newCustLimit, setNewCustLimit] = useState<number>(5000);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Live queries
  const products = useLiveQuery(() => db.products.toArray());
  const customers = useLiveQuery(() => db.customers.toArray());
  const latestSale = useLiveQuery(() => db.sales.orderBy('id').last());

  // Focus barcode input on mount
  useEffect(() => {
    barcodeInputRef.current?.focus();
    loadHeldCarts();
  }, []);

  // Update split payment inputs when cart total changes
  const { netTotal } = calculateTotals();
  useEffect(() => {
    if (paymentMode === 'Split') {
      setCashAmount(Math.floor(netTotal / 2));
      setUpiAmount(netTotal - Math.floor(netTotal / 2));
    }
  }, [paymentMode, netTotal]);

  // Load selected customer's credit details
  const activeCustomer = customers?.find(c => c.id === selectedCustomerId);
  useEffect(() => {
    if (activeCustomer) {
      setCreditAvailable(activeCustomer.creditLimit - activeCustomer.outstandingDue);
    }
  }, [selectedCustomerId, customers, activeCustomer]);

  // 1. Barcode Auto-submission handler
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeQuery.trim()) return;

    const matchedProduct = products?.find(
      p => p.barcode === barcodeQuery.trim() || p.sku.toLowerCase() === barcodeQuery.trim().toLowerCase()
    );

    if (matchedProduct) {
      if (matchedProduct.stockQuantity <= 0) {
        addToast(`${matchedProduct.name} is OUT OF STOCK!`, 'danger');
      } else {
        addToCart(matchedProduct);
        addToast(`Scanned: ${matchedProduct.name}`, 'success');
      }
    } else {
      addToast(`Barcode/SKU "${barcodeQuery}" not registered!`, 'warning');
    }
    setBarcodeQuery('');
    barcodeInputRef.current?.focus();
  };

  // Add Item helper
  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.product.id === product.id);
      if (existingIndex > -1) {
        const item = prevCart[existingIndex];
        const newQty = item.quantity + 1;
        if (newQty > product.stockQuantity) {
          addToast(`Only ${product.stockQuantity} items in stock.`, 'warning');
          return prevCart;
        }
        const updated = [...prevCart];
        updated[existingIndex] = { ...item, quantity: newQty };
        return updated;
      } else {
        return [...prevCart, { product, quantity: 1, discount: 0 }];
      }
    });
  };

  // Adjust item quantity
  const updateQty = (productId: number, qty: number) => {
    const product = products?.find(p => p.id === productId);
    if (!product) return;

    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }

    if (qty > product.stockQuantity) {
      addToast(`Only ${product.stockQuantity} items in stock for ${product.name}`, 'warning');
      return;
    }

    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity: qty } : item));
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Total calculation logic
  function calculateTotals() {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;
    let totalItems = 0;

    cart.forEach(item => {
      const lineTaxable = (item.product.sellingPrice - item.discount) * item.quantity;
      const lineTax = lineTaxable * (item.product.taxRate / 100);
      
      subtotal += lineTaxable;
      taxTotal += lineTax;
      discountTotal += item.discount * item.quantity;
      totalItems += item.quantity;
    });

    const netTotal = subtotal + taxTotal;

    return {
      subtotal,
      taxTotal,
      discountTotal,
      netTotal,
      totalItems
    };
  }

  // Quick Customer Creation
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName || !newCustPhone) return;

    try {
      const newId = await db.customers.add({
        name: newCustName,
        phone: newCustPhone,
        outstandingDue: 0,
        creditLimit: newCustLimit
      });

      await db.auditLogs.add({
        dateTime: new Date(),
        userId: currentUser,
        userRole,
        action: 'Create Customer',
        details: `Quick added customer ${newCustName} from billing desk.`
      });

      setSelectedCustomerId(newId);
      setIsCustomerModalOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      addToast(`Customer ${newCustName} registered!`, 'success');
    } catch (err: any) {
      addToast('Error registering customer.', 'danger');
    }
  };

  // 2. Hold / Resume Bill logic
  const handleHoldBill = () => {
    if (cart.length === 0) return;
    
    const customer = customers?.find(c => c.id === selectedCustomerId);
    const newHold: HeldCart = {
      id: `HOLD-${Date.now()}`,
      dateTime: new Date(),
      customerId: selectedCustomerId,
      customerName: customer ? customer.name : 'Walk-in',
      items: [...cart]
    };

    const currentHeld = JSON.parse(localStorage.getItem('smart_pos_held_carts') || '[]');
    currentHeld.push(newHold);
    localStorage.setItem('smart_pos_held_carts', JSON.stringify(currentHeld));
    
    setHeldCarts(currentHeld);
    setCart([]);
    setSelectedCustomerId(1);
    addToast('Bill placed on Hold.', 'warning');
  };

  const loadHeldCarts = () => {
    const currentHeld = JSON.parse(localStorage.getItem('smart_pos_held_carts') || '[]');
    setHeldCarts(currentHeld);
  };

  const resumeCart = (heldId: string) => {
    const target = heldCarts.find(h => h.id === heldId);
    if (!target) return;

    setCart(target.items);
    setSelectedCustomerId(target.customerId);
    
    const updated = heldCarts.filter(h => h.id !== heldId);
    localStorage.setItem('smart_pos_held_carts', JSON.stringify(updated));
    setHeldCarts(updated);
    addToast(`Resumed bill for: ${target.customerName}`, 'success');
  };

  const discardHeldCart = (heldId: string) => {
    const updated = heldCarts.filter(h => h.id !== heldId);
    localStorage.setItem('smart_pos_held_carts', JSON.stringify(updated));
    setHeldCarts(updated);
    addToast('Held bill discarded.', 'danger');
  };

  // 3. Checkout execution
  const handleCheckout = async () => {
    if (cart.length === 0) {
      addToast('Cart is empty!', 'warning');
      return;
    }

    const { netTotal, discountTotal } = calculateTotals();

    // Validations
    if (paymentMode === 'Credit') {
      if (selectedCustomerId === 1) {
        addToast('Walk-in Customers cannot purchase on credit! Select registered customer.', 'danger');
        return;
      }
      if (creditAvailable < netTotal) {
        addToast(`Insufficient credit limit! Available: ₹${creditAvailable.toFixed(2)}, Required: ₹${netTotal.toFixed(2)}`, 'danger');
        return;
      }
    }

    if (paymentMode === 'Split') {
      const splitSum = Number(cashAmount) + Number(upiAmount);
      if (Math.abs(splitSum - netTotal) > 0.05) {
        addToast(`Split payment mismatch. Cash + UPI must equal ₹${netTotal.toFixed(2)}`, 'danger');
        return;
      }
    }

    try {
      // Build invoice number INV-10001 series
      const lastInvoiceNum = latestSale ? parseInt(latestSale.invoiceNo.split('-')[1]) : 10000;
      const nextInvoiceNo = `INV-${lastInvoiceNum + 1}`;

      const customerName = activeCustomer ? activeCustomer.name : 'Walk-in Customer';
      const splitDetails = paymentMode === 'Split' ? `Cash: ₹${cashAmount}, UPI: ₹${upiAmount}` : '';

      await executeSaleTransaction(
        nextInvoiceNo,
        selectedCustomerId,
        customerName,
        cart,
        paymentMode,
        splitDetails,
        discountTotal,
        currentUser,
        userRole
      );

      setInvoiceNo(nextInvoiceNo);
      setIsCheckoutModalOpen(true);
      addToast(`Checkout Complete! ${nextInvoiceNo} saved.`, 'success');
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Error completing checkout.', 'danger');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const text = `Smart POS Invoice: ${invoiceNo}%0AStore: Smart POS Store%0ATotal Amount: ₹${netTotal.toFixed(2)}%0APayment Mode: ${paymentMode}%0AThank you for shopping with us!`;
    const url = `https://wa.me/${activeCustomer?.phone || ''}?text=${text}`;
    window.open(url, '_blank');
  };

  const resetBilling = () => {
    setCart([]);
    setSelectedCustomerId(1);
    setPaymentMode('Cash');
    setIsCheckoutModalOpen(false);
    setInvoiceNo('');
    barcodeInputRef.current?.focus();
  };

  // Filter products by category and search
  const filteredProducts = products?.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.barcode.includes(searchQuery) ||
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ['All', 'Groceries', 'Dairy', 'Personal Care', 'Snacks', 'Apparel'];



  return (
    <div className="content-wrapper">
      <div className="billing-layout">
        
        {/* Catalog Panel (Left) */}
        <div className="catalog-panel">
          <div className="catalog-search-bar">
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} size={20} />
              <input
                type="text"
                placeholder="Search products by Name, Barcode, SKU... (F4)"
                className="form-input"
                style={{ paddingLeft: '40px' }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* Barcode scanner dummy field */}
            <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flexGrow: 1 }}>
                <Barcode style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--color-primary)' }} size={20} />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Barcode..."
                  className="form-input"
                  style={{ paddingLeft: '36px', borderColor: 'rgba(249,115,22,0.4)' }}
                  value={barcodeQuery}
                  onChange={e => setBarcodeQuery(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '0 16px' }}>Scan</button>
            </form>
          </div>

          {/* Categories Tab bar */}
          <div className="category-filter">
            {categories.map(cat => (
              <span
                key={cat}
                className={`category-tab ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </span>
            ))}
          </div>

          {/* Product list */}
          <div className="product-grid">
            {filteredProducts?.map(prod => {
              const isLowStock = prod.stockQuantity <= prod.reorderLevel && prod.stockQuantity > 0;
              const isOutOfStock = prod.stockQuantity === 0;
              
              return (
                <div
                  key={prod.id}
                  className={`product-card ${isLowStock ? 'low-stock' : ''} ${isOutOfStock ? 'out-of-stock' : ''}`}
                  onClick={() => !isOutOfStock && addToCart(prod)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{prod.category}</span>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineBreak: 'anywhere' }}>{prod.name}</strong>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      BC: {prod.barcode}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                    <span style={{ fontWeight: 800, color: 'var(--color-primary)' }}>₹{prod.sellingPrice}</span>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      color: isOutOfStock ? 'var(--color-danger)' : isLowStock ? 'var(--color-warning)' : 'var(--color-success)'
                    }}>
                      {isOutOfStock ? 'Out' : `${prod.stockQuantity} Left`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart Checkout Panel (Right) */}
        <div className="cart-panel">
          {/* Cart Header with Customer Selection & Hold options */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingBag size={18} style={{ color: 'var(--color-primary)' }} />
                Active Cart ({cart.reduce((sum, i) => sum + i.quantity, 0)})
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ padding: '8px' }} title="Hold Bill" onClick={handleHoldBill}>
                  <Pause size={16} />
                </button>
                {heldCarts.length > 0 && (
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      backgroundColor: 'var(--color-warning)',
                      color: '#000',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>{heldCarts.length}</span>
                    <button className="btn btn-secondary" style={{ padding: '8px' }} title="Resume Bills" onClick={loadHeldCarts}>
                      <Play size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Customer selector */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="form-input"
                style={{ flexGrow: 1, padding: '8px 12px' }}
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(Number(e.target.value))}
              >
                {customers?.map(cust => (
                  <option key={cust.id} value={cust.id}>
                    {cust.name} {cust.phone !== '0000000000' ? `(${cust.phone})` : ''} 
                    {cust.outstandingDue > 0 ? ` [Due: ₹${cust.outstandingDue}]` : ''}
                  </option>
                ))}
              </select>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '8px 12px' }} 
                onClick={() => setIsCustomerModalOpen(true)}
              >
                <UserPlus size={18} />
              </button>
            </div>
          </div>

          {/* Cart items list */}
          <div className="cart-items">
            {cart.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '10px' }}>
                <ShoppingBag size={48} strokeWidth={1} />
                <span>Cart is empty. Scan items to checkout</span>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product.id} className="cart-item">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexGrow: 1, maxWidth: '50%' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{item.product.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ₹{item.product.sellingPrice} (Tax: {item.product.taxRate}%)
                    </span>
                  </div>

                  {/* Quantity Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      onClick={() => updateQty(item.product.id!, item.quantity - 1)}
                    >-</button>
                    <input
                      type="number"
                      value={item.quantity}
                      className="form-input"
                      style={{ width: '45px', padding: '4px 6px', textAlign: 'center', fontSize: '0.85rem' }}
                      onChange={e => updateQty(item.product.id!, Number(e.target.value))}
                    />
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      onClick={() => updateQty(item.product.id!, item.quantity + 1)}
                    >+</button>
                  </div>

                  {/* Price & Remove */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', marginLeft: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      ₹{((item.product.sellingPrice - item.discount) * item.quantity).toFixed(2)}
                    </span>
                    <button 
                      style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}
                      onClick={() => removeFromCart(item.product.id!)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart totals & payment checkout */}
          {cart.length > 0 && (
            <div className="cart-totals">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>Subtotal (Excl. Tax & Disc)</span>
                <span>₹{(netTotal - calculateTotals().taxTotal).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-success)' }}>
                <span>Discount Impact</span>
                <span>-₹{calculateTotals().discountTotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>GST Tax Collected</span>
                <span>₹{calculateTotals().taxTotal.toFixed(2)}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '10px', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                <span>Payable Net</span>
                <span style={{ color: 'var(--color-primary)' }}>₹{netTotal.toFixed(2)}</span>
              </div>

              {/* Payment selector */}
              <div className="form-group" style={{ marginTop: '8px', marginBottom: '8px' }}>
                <span className="form-label">Payment Option</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {(['Cash', 'Card', 'UPI', 'Credit', 'Split'] as const).map(mode => (
                    <button
                      key={mode}
                      className={`btn ${paymentMode === mode ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '8px 4px', fontSize: '0.75rem' }}
                      onClick={() => setPaymentMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Split Details Input */}
              {paymentMode === 'Split' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <div className="form-group" style={{ flexGrow: 1, marginBottom: 0 }}>
                    <span className="form-label" style={{ fontSize: '0.7rem' }}>Cash Amt</span>
                    <input
                      type="number"
                      className="form-input"
                      style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                      value={cashAmount}
                      onChange={e => {
                        setCashAmount(Number(e.target.value));
                        setUpiAmount(Math.max(0, netTotal - Number(e.target.value)));
                      }}
                    />
                  </div>
                  <div className="form-group" style={{ flexGrow: 1, marginBottom: 0 }}>
                    <span className="form-label" style={{ fontSize: '0.7rem' }}>UPI Amt</span>
                    <input
                      type="number"
                      className="form-input"
                      style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                      value={upiAmount}
                      onChange={e => {
                        setUpiAmount(Number(e.target.value));
                        setCashAmount(Math.max(0, netTotal - Number(e.target.value)));
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Credit check details */}
              {paymentMode === 'Credit' && (
                <div style={{ 
                  backgroundColor: creditAvailable >= netTotal ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)', 
                  border: creditAvailable >= netTotal ? '1px solid var(--color-success)' : '1px solid var(--color-danger)', 
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  color: creditAvailable >= netTotal ? 'var(--color-success)' : 'var(--color-danger)',
                  marginBottom: '8px'
                }}>
                  <span>Outstanding Dues: ₹{activeCustomer?.outstandingDue} / Credit Limit: ₹{activeCustomer?.creditLimit}</span>
                  <div style={{ fontWeight: 600, marginTop: '2px' }}>
                    {creditAvailable >= netTotal 
                      ? `Approved: Credit Balance of ₹${creditAvailable.toFixed(2)} remaining.` 
                      : `Credit Limit Exceeded by ₹${(netTotal - creditAvailable).toFixed(2)}`}
                  </div>
                </div>
              )}

              <button className="btn btn-success" style={{ width: '100%', height: '48px', fontSize: '1rem' }} onClick={handleCheckout}>
                Charge (₹{netTotal.toFixed(2)})
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Held bills list tray (loaded when clicking Resume play button) */}
      {heldCarts.length > 0 && (
        <div className="card" style={{ marginTop: '24px', border: '1px solid var(--color-warning)' }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--color-warning)', marginBottom: '12px' }}>Held Bills Drawer</h4>
          <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
            {heldCarts.map(hc => (
              <div key={hc.id} style={{
                minWidth: '220px',
                padding: '12px',
                backgroundColor: 'var(--bg-input)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '0.8rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <strong>{hc.customerName}</strong>
                  <span style={{ color: 'var(--text-muted)' }}>{new Date(hc.dateTime).toLocaleTimeString()}</span>
                </div>
                <div style={{ marginBottom: '8px', color: 'var(--text-secondary)' }}>
                  {hc.items.length} item types ({hc.items.reduce((s, i) => s + i.quantity, 0)} qty)
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem', flexGrow: 1 }} onClick={() => resumeCart(hc.id)}>Resume</button>
                  <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => discardHeldCart(hc.id)}>Discard</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Customer Register Modal */}
      {isCustomerModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Quick Customer Registration</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setIsCustomerModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer}>
              <div className="form-group">
                <span className="form-label">Full Name</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sanjay Verma"
                  className="form-input"
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <span className="form-label">Mobile Number</span>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  className="form-input"
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                />
              </div>
              <div className="form-group">
                <span className="form-label">Credit Limit (₹)</span>
                <input
                  type="number"
                  placeholder="e.g. 10000"
                  className="form-input"
                  value={newCustLimit}
                  onChange={e => setNewCustLimit(Number(e.target.value))}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={() => setIsCustomerModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Register & Select</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Invoice Modal (Thermal vs A4 Preview) */}
      {isCheckoutModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', fontWeight: 700 }}>
                <CheckCircle size={20} />
                Invoice Generated
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  className={`btn ${invoiceMode === 'thermal' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  onClick={() => setInvoiceMode('thermal')}
                >Thermal Receipt</button>
                <button 
                  className={`btn ${invoiceMode === 'a4' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  onClick={() => setInvoiceMode('a4')}
                >Standard A4 GST</button>
              </div>
            </div>

            {/* Printable Invoice Container */}
            <div className="invoice-container-preview" style={{ 
              backgroundColor: '#fff', 
              color: '#000', 
              padding: invoiceMode === 'thermal' ? '15px' : '30px', 
              borderRadius: '8px', 
              fontFamily: invoiceMode === 'thermal' ? 'monospace' : 'inherit',
              boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)',
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
              
              {/* Actual HTML structure matched with @media print */}
              <div className={`printable-invoice ${invoiceMode === 'thermal' ? '' : 'a4-invoice'}`} style={{ display: 'block' }}>
                
                {invoiceMode === 'thermal' ? (
                  // Thermal printer layout (80mm width)
                  <div style={{ textAlign: 'center', fontSize: '12px', width: '100%' }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>SMART POS STORES</h3>
                    <p style={{ margin: '0 0 2px 0' }}>12, Market Square, New Delhi</p>
                    <p style={{ margin: '0 0 4px 0' }}>GSTIN: 07AAAAA1111A1Z1</p>
                    <p style={{ margin: '0 0 8px 0' }}>Tel: 9876543210</p>
                    <p style={{ borderBottom: '1px dashed #000', margin: '4px 0' }} />
                    
                    <div style={{ textAlign: 'left', margin: '6px 0' }}>
                      <div><strong>Invoice:</strong> {invoiceNo}</div>
                      <div><strong>Date:</strong> {new Date().toLocaleString()}</div>
                      <div><strong>Cashier:</strong> {currentUser}</div>
                      <div><strong>Customer:</strong> {activeCustomer ? activeCustomer.name : 'Walk-in'}</div>
                    </div>
                    <p style={{ borderBottom: '1px dashed #000', margin: '4px 0' }} />
                    
                    <table style={{ width: '100%', fontSize: '11px', textAlign: 'left' }}>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Qty</th>
                          <th style={{ textAlign: 'right' }}>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map(item => (
                          <tr key={item.product.id}>
                            <td>{item.product.name}</td>
                            <td>{item.quantity}</td>
                            <td style={{ textAlign: 'right' }}>₹{((item.product.sellingPrice - item.discount) * item.quantity).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />
                    
                    <div style={{ textAlign: 'right', fontSize: '12px', fontWeight: 'bold' }}>
                      <div>Subtotal: ₹{(netTotal - calculateTotals().taxTotal).toFixed(2)}</div>
                      <div>GST Tax: ₹{calculateTotals().taxTotal.toFixed(2)}</div>
                      <div style={{ fontSize: '14px' }}>Net Total: ₹{netTotal.toFixed(2)}</div>
                    </div>
                    
                    <p style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />
                    <div style={{ marginTop: '8px' }}>
                      <strong>Payment Mode: {paymentMode}</strong>
                      <p style={{ margin: '4px 0 0 0', fontSize: '10px' }}>Thank you! Visit Again.</p>
                    </div>
                  </div>
                ) : (
                  // A4 GST Invoice Layout
                  <div style={{ fontSize: '12px', color: '#333' }}>
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #ddd', paddingBottom: '15px' }}>
                      <div>
                        <h2 style={{ color: 'var(--color-primary)', margin: '0 0 4px 0' }}>SMART POS RETAILS</h2>
                        <p style={{ margin: '2px 0' }}>12, Market Square, Connaught Place, New Delhi</p>
                        <p style={{ margin: '2px 0' }}><strong>GSTIN:</strong> 07AAAAA1111A1Z1 | <strong>Email:</strong> billing@smartpos.com</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <h2 style={{ margin: '0 0 4px 0' }}>TAX INVOICE</h2>
                        <p style={{ margin: '2px 0' }}><strong>Invoice No:</strong> {invoiceNo}</p>
                        <p style={{ margin: '2px 0' }}><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', margin: '15px 0' }}>
                      <div>
                        <strong style={{ color: '#555' }}>Billed To (Customer):</strong>
                        <p style={{ margin: '4px 0', fontSize: '13px', fontWeight: 'bold' }}>{activeCustomer?.name || 'Walk-in Customer'}</p>
                        <p style={{ margin: '2px 0' }}>Phone: {activeCustomer?.phone !== '0000000000' ? activeCustomer?.phone : 'N/A'}</p>
                        <p style={{ margin: '2px 0' }}>Email: {activeCustomer?.email || 'N/A'}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '2px 0' }}><strong>Place of Supply:</strong> Delhi (07)</p>
                        <p style={{ margin: '2px 0' }}><strong>Terms:</strong> Due on Checkout</p>
                      </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', margin: '15px 0' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Product / Service</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Qty</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Unit Price</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>GST Rate</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Total (INR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px' }}>{item.product.name}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>{item.quantity}</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>₹{(item.product.sellingPrice - item.discount).toFixed(2)}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>{item.product.taxRate}%</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              ₹{((item.product.sellingPrice - item.discount) * item.quantity * (1 + item.product.taxRate / 100)).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderTop: '2px solid #ddd', paddingTop: '10px' }}>
                      <div style={{ width: '50%' }}>
                        <strong>Declarations:</strong>
                        <p style={{ margin: '4px 0', fontSize: '10px', color: '#777' }}>1. Certified that the particulars given above are true and correct.</p>
                        <p style={{ margin: '2px 0', fontSize: '10px', color: '#777' }}>2. Goods once sold will not be taken back or exchanged.</p>
                      </div>
                      <div style={{ width: '40%', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
                          <span>Subtotal:</span>
                          <span>₹{(netTotal - calculateTotals().taxTotal).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
                          <span>CGST Split:</span>
                          <span>₹{(calculateTotals().taxTotal / 2).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
                          <span>SGST Split:</span>
                          <span>₹{(calculateTotals().taxTotal / 2).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #ddd', padding: '6px 0', fontWeight: 'bold', fontSize: '14px' }}>
                          <span>Total Amount:</span>
                          <span>₹{netTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

            </div>

            {/* Actions for Invoice Print/Share */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={handlePrint}>
                <Printer size={18} />
                Print Invoice
              </button>
              <button className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={handleWhatsAppShare}>
                <Share2 size={18} />
                WhatsApp Share
              </button>
              <button className="btn btn-success" style={{ flexGrow: 1 }} onClick={resetBilling}>
                Done / New Bill
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
