import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { 
  TrendingUp, 
  DollarSign, 
  Percent, 
  ShieldAlert,
  Calendar,
  Layers,
  Download,
  Info
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';

interface ReportsProps {
  currentUser: string;
  userRole: string;
  addToast: (msg: string, type?: 'success' | 'warning' | 'danger') => void;
}

export const Reports: React.FC<ReportsProps> = ({ userRole, addToast }) => {
  const [dateFilter, setDateFilter] = useState<'Today' | 'Month' | 'All'>('Today');

  // Permission Checks
  const isAuthorized = userRole === 'Owner' || userRole === 'Accountant' || userRole === 'Admin';
  const showProfit = userRole === 'Owner' || userRole === 'Accountant';

  // Live queries
  const sales = useLiveQuery(() => db.sales.toArray());
  const saleItems = useLiveQuery(() => db.saleItems.toArray());
  const products = useLiveQuery(() => db.products.toArray());
  const customers = useLiveQuery(() => db.customers.toArray());

  if (!isAuthorized) {
    return (
      <div className="content-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <ShieldAlert size={60} style={{ color: 'var(--color-danger)', marginBottom: '16px' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Access Unauthorized</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Only Owners, Admin, and Accountants are authorized to access Reports.</p>
      </div>
    );
  }

  if (!sales || !saleItems || !products || !customers) {
    return <div style={{ color: 'var(--text-secondary)', padding: '20px' }}>Loading business analytics...</div>;
  }

  // Filter sales based on tab
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const filteredSales = sales.filter(s => {
    const saleTime = new Date(s.dateTime).getTime();
    if (dateFilter === 'Today') return saleTime >= startOfToday;
    if (dateFilter === 'Month') return saleTime >= startOfMonth;
    return true;
  });

  // KPI Calculations
  const revenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const taxCollected = filteredSales.reduce((sum, s) => sum + s.taxAmount, 0);
  const discountImpact = filteredSales.reduce((sum, s) => sum + s.discountAmount, 0);
  const grossProfit = filteredSales.reduce((sum, s) => sum + s.profitAmount, 0);
  const transactionCount = filteredSales.length;



  // Category Sales Breakdowns
  const categorySalesMap: { [key: string]: number } = {};
  filteredSales.forEach(sale => {
    const items = saleItems.filter(item => item.saleId === sale.id);
    items.forEach(item => {
      // Find category of item product
      const product = products.find(p => p.id === item.productId);
      const category = product ? product.category : 'General';
      categorySalesMap[category] = (categorySalesMap[category] || 0) + item.totalAmount;
    });
  });
  const categorySalesChart = Object.keys(categorySalesMap).map(key => ({
    category: key,
    Sales: categorySalesMap[key]
  }));

  // Store Valuation
  const totalCostValuation = products.reduce((sum, p) => sum + p.costPrice * p.stockQuantity, 0);
  const totalRetailValuation = products.reduce((sum, p) => sum + p.sellingPrice * p.stockQuantity, 0);

  // Total customer dues outstanding
  const totalCustomerDues = customers.reduce((sum, c) => sum + c.outstandingDue, 0);

  const exportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Invoice No,Date,Customer,Total Amount,Tax Amount,Payment Mode,Status\n';
    
    filteredSales.forEach(s => {
      csvContent += `${s.invoiceNo},${new Date(s.dateTime).toLocaleDateString()},${s.customerName},${s.totalAmount},${s.taxAmount},${s.paymentMode},${s.status}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smart_pos_sales_report_${dateFilter.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Sales report exported to CSV!', 'success');
  };

  return (
    <div className="content-wrapper">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Reports & Business Insights</h1>
          <p className="screen-subtitle">Monitor shop margins, tax liabilities, and inventory valuation metrics</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Date Filter & Aggregation Toggle */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', paddingBottom: '8px' }}>
        {(['Today', 'Month', 'All'] as const).map(tab => (
          <button 
            key={tab}
            className={`btn ${dateFilter === tab ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            onClick={() => setDateFilter(tab)}
          >
            {tab === 'Today' ? "Today's Summary" : tab === 'Month' ? 'This Month (MTD)' : 'All Time History'}
          </button>
        ))}
      </div>

      {/* Analytics KPI Widgets */}
      <div className="kpi-grid">
        {/* Metric 1: Sales Revenue */}
        <div className="kpi-card">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)', color: 'var(--color-primary)' }}>
            <TrendingUp size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-title">Sales Revenue</span>
            <span className="kpi-value">₹{revenue.toLocaleString('en-IN')}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Completed {transactionCount} invoices
            </span>
          </div>
        </div>

        {/* Metric 2: Profit Margin */}
        <div className="kpi-card">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)' }}>
            <DollarSign size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-title">Gross Profits</span>
            <span className="kpi-value" style={{ color: showProfit ? 'var(--color-success)' : 'inherit' }}>
              {showProfit ? `₹${grossProfit.toLocaleString('en-IN')}` : '₹ •••••'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {showProfit ? `Margin: ~ ${revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : 0}%` : 'Authorized only'}
            </span>
          </div>
        </div>

        {/* Metric 3: GST Tax collected */}
        <div className="kpi-card">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(6, 182, 212, 0.15)', color: 'var(--color-info)' }}>
            <Percent size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-title">Taxes (GST Liability)</span>
            <span className="kpi-value">₹{taxCollected.toLocaleString('en-IN')}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Split: CGST { (taxCollected/2).toFixed(2) } | SGST { (taxCollected/2).toFixed(2) }
            </span>
          </div>
        </div>

        {/* Metric 4: Discount Impact */}
        <div className="kpi-card">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', color: 'var(--color-warning)' }}>
            <Calendar size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-title">Discount Claims</span>
            <span className="kpi-value" style={{ color: 'var(--color-warning)' }}>₹{discountImpact.toLocaleString('en-IN')}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Total given at billing counter
            </span>
          </div>
        </div>
      </div>

      {/* Valuation & Dues Details Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        
        {/* Category Sales Bar Chart */}
        <div className="card" style={{ height: '320px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: 'var(--color-primary)' }} />
            Sales Revenue by Category
          </h3>
          <div style={{ flexGrow: 1, width: '100%', height: '80%' }}>
            {categorySalesChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categorySalesChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="category" stroke="var(--text-secondary)" fontSize={11} />
                  <YAxis stroke="var(--text-secondary)" fontSize={11} />
                  <Tooltip formatter={(value: any) => `₹${value}`} />
                  <Bar dataKey="Sales" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                No category sales records in this timeline.
              </div>
            )}
          </div>
        </div>

        {/* Valuation & Ledger statistics */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={18} style={{ color: 'var(--color-info)' }} />
            Valuation Metrics
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1 }}>
            <div style={{ padding: '12px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stock Cost Value (Investment)</div>
              <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>₹{totalCostValuation.toLocaleString('en-IN')}</strong>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Retail Selling Value</div>
              <strong style={{ fontSize: '1.2rem', color: 'var(--color-primary)' }}>₹{totalRetailValuation.toLocaleString('en-IN')}</strong>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Outstanding Customer Credits (Khata Book)</div>
              <strong style={{ fontSize: '1.2rem', color: 'var(--color-danger)' }}>₹{totalCustomerDues.toLocaleString('en-IN')}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History log table */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>
          Detailed Transaction Log for selected Filter
        </div>
        
        <div className="table-container" style={{ border: 'none' }}>
          <table className="pos-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Date & Time</th>
                <th>Customer</th>
                <th>Payment Mode</th>
                <th style={{ textAlign: 'right' }}>Tax Collected</th>
                <th style={{ textAlign: 'right' }}>Discount</th>
                <th style={{ textAlign: 'right' }}>Total amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length > 0 ? (
                filteredSales.map(sale => (
                  <tr key={sale.id}>
                    <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{sale.invoiceNo}</td>
                    <td>{new Date(sale.dateTime).toLocaleString()}</td>
                    <td>{sale.customerName}</td>
                    <td>
                      <span className={`badge ${sale.paymentMode === 'Credit' ? 'badge-danger' : 'badge-success'}`}>
                        {sale.paymentMode}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>₹{sale.taxAmount.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-warning)' }}>₹{sale.discountAmount.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{sale.totalAmount.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    No sales recorded in the selected timeline.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
