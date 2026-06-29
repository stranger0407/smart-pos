import Dexie, { type Table } from 'dexie';

export interface Product {
  id?: number;
  name: string;
  barcode: string;
  sku: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  taxRate: number; // e.g., 18 for 18% GST
  stockQuantity: number;
  reorderLevel: number;
  supplierId?: number;
  expiryDate?: string;
}

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  email?: string;
  outstandingDue: number; // positive means they owe us money
  creditLimit: number;
}

export interface Supplier {
  id?: number;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
}

export interface Sale {
  id?: number;
  invoiceNo: string;
  dateTime: Date;
  customerId?: number; // undefined or 0 for Walk-in
  customerName: string; // Snapshot for easy listing
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  profitAmount: number;
  paymentMode: 'Cash' | 'Card' | 'UPI' | 'Credit' | 'Split';
  paymentModeDetails?: string; // e.g., "Cash: 500, UPI: 300"
  paymentStatus: 'Paid' | 'Unpaid' | 'Partial';
  status: 'Completed' | 'Returned' | 'Cancelled';
  cashierId: string; // User identity
}

export interface SaleItem {
  id?: number;
  saleId: number;
  productId: number;
  productName: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  taxRate: number;
  discountAmount: number;
  totalAmount: number;
}

export interface Purchase {
  id?: number;
  poNo: string;
  supplierId: number;
  supplierName: string;
  dateTime: Date;
  totalAmount: number;
  paymentStatus: 'Paid' | 'Unpaid' | 'Partial';
  status: 'Draft' | 'Ordered' | 'Received' | 'Cancelled';
}

export interface PurchaseItem {
  id?: number;
  purchaseId: number;
  productId: number;
  productName: string;
  quantity: number;
  costPrice: number;
  totalAmount: number;
}

export interface CustomerLedger {
  id?: number;
  customerId: number;
  dateTime: Date;
  type: 'Sale' | 'Payment' | 'Refund' | 'Adjustment';
  amount: number; // positive for sale (debt added), negative for payment (debt settled)
  balance: number; // running balance after this transaction
  notes?: string;
}

export interface SupplierLedger {
  id?: number;
  supplierId: number;
  dateTime: Date;
  type: 'Purchase' | 'Payment' | 'Return' | 'Adjustment';
  amount: number; // positive for purchase (we owe them), negative for payment (we paid them)
  balance: number; // running balance after this transaction
  notes?: string;
}

export interface CashDrawer {
  id?: number;
  dateTime: Date;
  type: 'Cash In' | 'Cash Out' | 'Opening' | 'Closing';
  amount: number;
  cashierId: string;
  notes?: string;
}

export interface AuditLog {
  id?: number;
  dateTime: Date;
  userId: string;
  userRole: string;
  action: string;
  details: string;
}

class SmartPOSDatabase extends Dexie {
  products!: Table<Product>;
  customers!: Table<Customer>;
  suppliers!: Table<Supplier>;
  sales!: Table<Sale>;
  saleItems!: Table<SaleItem>;
  purchases!: Table<Purchase>;
  purchaseItems!: Table<PurchaseItem>;
  customerLedger!: Table<CustomerLedger>;
  supplierLedger!: Table<SupplierLedger>;
  cashDrawer!: Table<CashDrawer>;
  auditLogs!: Table<AuditLog>;

  constructor() {
    super('SmartPOSDatabase');
    this.version(1).stores({
      products: '++id, name, barcode, sku, category, supplierId',
      customers: '++id, name, phone, outstandingDue',
      suppliers: '++id, name, phone',
      sales: '++id, invoiceNo, dateTime, customerId, paymentMode, paymentStatus, status',
      saleItems: '++id, saleId, productId',
      purchases: '++id, poNo, supplierId, status',
      purchaseItems: '++id, purchaseId, productId',
      customerLedger: '++id, customerId, dateTime',
      supplierLedger: '++id, supplierId, dateTime',
      cashDrawer: '++id, dateTime, type',
      auditLogs: '++id, dateTime, userId, userRole',
    });
  }
}

export const db = new SmartPOSDatabase();

// Seed Database Function
export async function seedDatabase() {
  const productCount = await db.products.count();
  if (productCount > 0) return; // already seeded

  console.log('Seeding Smart POS database with premium initial dataset...');

  // 1. Suppliers
  const s1 = await db.suppliers.add({ name: 'Supreme Grocery Distributors', contactPerson: 'Rajesh Sharma', phone: '9876501234', email: 'sales@supreme.com' });
  const s2 = await db.suppliers.add({ name: 'Ganesh Dairy Products', contactPerson: 'Ganesh Patel', phone: '9812345678', email: 'info@ganeshdairy.com' });
  const s3 = await db.suppliers.add({ name: 'Krishna Apparel Hub', contactPerson: 'Karan Mehra', phone: '9988776655', email: 'orders@krishnahub.in' });
  const s4 = await db.suppliers.add({ name: 'Hindustan Care Agencies', contactPerson: 'Amit Kumar', phone: '9112233445', email: 'care@hindustan.com' });

  // 2. Customers
  await db.customers.add({ name: 'Walk-in Customer', phone: '0000000000', email: '', outstandingDue: 0, creditLimit: 0 });
  const c1 = await db.customers.add({ name: 'Rahul Sharma', phone: '9898989898', email: 'rahul.s@outlook.com', outstandingDue: 2450, creditLimit: 10000 });
  await db.customers.add({ name: 'Pooja Patel', phone: '9797979797', email: 'pooja.patel@gmail.com', outstandingDue: 0, creditLimit: 5000 });
  const c3 = await db.customers.add({ name: 'Amit Verma', phone: '9696969696', email: 'amit.verma@yahoo.com', outstandingDue: 4500, creditLimit: 15000 });
  await db.customers.add({ name: 'Sanjay Gupta', phone: '9595959595', email: 'sanjay.gupta@guptastores.com', outstandingDue: 0, creditLimit: 20000 });

  // Seed Customer Ledger (History) for Rahul and Amit
  await db.customerLedger.add({
    customerId: c1,
    dateTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    type: 'Sale',
    amount: 3000,
    balance: 3000,
    notes: 'Invoice #INV-10001 (Udhar/Credit purchase)',
  });
  await db.customerLedger.add({
    customerId: c1,
    dateTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    type: 'Payment',
    amount: -550,
    balance: 2450,
    notes: 'Paid cash at counter - received by Cashier',
  });

  await db.customerLedger.add({
    customerId: c3,
    dateTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    type: 'Sale',
    amount: 4500,
    balance: 4500,
    notes: 'Invoice #INV-10002 (Udhar/Credit purchase)',
  });

  // 3. Products
  await db.products.bulkAdd([
    {
      name: 'Golden Grain Basmati Rice (1kg)',
      barcode: '8901234567890',
      sku: 'GROC-RICE-001',
      category: 'Groceries',
      costPrice: 90,
      sellingPrice: 120,
      taxRate: 5, // 5% GST
      stockQuantity: 45,
      reorderLevel: 15,
      supplierId: s1,
    },
    {
      name: 'Amul Fresh Milk (1L)',
      barcode: '8901234567891',
      sku: 'DAIRY-MILK-002',
      category: 'Dairy',
      costPrice: 52,
      sellingPrice: 62,
      taxRate: 0, // 0% tax on milk
      stockQuantity: 24,
      reorderLevel: 10,
      supplierId: s2,
    },
    {
      name: 'Clinique Plus Shampoo (175ml)',
      barcode: '8901234567892',
      sku: 'CARE-SHAM-003',
      category: 'Personal Care',
      costPrice: 110,
      sellingPrice: 145,
      taxRate: 18, // 18% GST
      stockQuantity: 18,
      reorderLevel: 5,
      supplierId: s4,
    },
    {
      name: 'Britannia Marie Gold Biscuits (250g)',
      barcode: '8901234567893',
      sku: 'SNAC-MARI-004',
      category: 'Snacks',
      costPrice: 22,
      sellingPrice: 30,
      taxRate: 18,
      stockQuantity: 50,
      reorderLevel: 15,
      supplierId: s1,
    },
    {
      name: 'Tata Salt Lite (1kg)',
      barcode: '8901234567894',
      sku: 'GROC-SALT-005',
      category: 'Groceries',
      costPrice: 20,
      sellingPrice: 28,
      taxRate: 0,
      stockQuantity: 35,
      reorderLevel: 10,
      supplierId: s1,
    },
    {
      name: 'Dettol Liquid Handwash (200ml)',
      barcode: '8901234567895',
      sku: 'CARE-HAND-006',
      category: 'Personal Care',
      costPrice: 75,
      sellingPrice: 99,
      taxRate: 18,
      stockQuantity: 4, // Trigger Low Stock!
      reorderLevel: 8,
      supplierId: s4,
    },
    {
      name: 'Aashirvaad Shudh Chakki Atta (5kg)',
      barcode: '8901234567896',
      sku: 'GROC-ATTA-007',
      category: 'Groceries',
      costPrice: 210,
      sellingPrice: 260,
      taxRate: 5,
      stockQuantity: 0, // Trigger Out of Stock!
      reorderLevel: 6,
      supplierId: s1,
    },
    {
      name: 'Classic Denim Jacket (L)',
      barcode: '8901234567897',
      sku: 'APPA-JACK-008',
      category: 'Apparel',
      costPrice: 650,
      sellingPrice: 1299,
      taxRate: 12, // 12% GST apparel
      stockQuantity: 10,
      reorderLevel: 3,
      supplierId: s3,
    },
    {
      name: 'Premium Leather Wallet',
      barcode: '8901234567898',
      sku: 'APPA-WALL-009',
      category: 'Apparel',
      costPrice: 250,
      sellingPrice: 499,
      taxRate: 12,
      stockQuantity: 15,
      reorderLevel: 5,
      supplierId: s3,
    },
    {
      name: 'Britannia Good Day Butter (100g)',
      barcode: '8901234567899',
      sku: 'SNAC-GOOD-010',
      category: 'Snacks',
      costPrice: 15,
      sellingPrice: 20,
      taxRate: 18,
      stockQuantity: 60,
      reorderLevel: 20,
      supplierId: s1,
    }
  ]);

  // 4. Initial Cash Drawer Opening Balance
  await db.cashDrawer.add({
    dateTime: new Date(Date.now() - 12 * 60 * 60 * 1000), // Today morning
    type: 'Opening',
    amount: 5000,
    cashierId: 'System',
    notes: 'Standard morning counter cash float',
  });

  // 5. System Seed Log
  await db.auditLogs.add({
    dateTime: new Date(),
    userId: 'System',
    userRole: 'Owner',
    action: 'Database Seed',
    details: 'Successfully seeded Smart POS database with pre-configured products, customers, suppliers and ledgers.',
  });
}

// Relational Operations Helper functions
export async function executeSaleTransaction(
  invoiceNo: string,
  customerId: number | undefined,
  customerName: string,
  cartItems: { product: Product; quantity: number; discount: number }[],
  paymentMode: 'Cash' | 'Card' | 'UPI' | 'Credit' | 'Split',
  paymentModeDetails: string,
  discountTotal: number,
  cashierId: string,
  userRole: string
): Promise<number> {
  return await db.transaction('rw', [db.products, db.sales, db.saleItems, db.customers, db.customerLedger, db.cashDrawer, db.auditLogs], async () => {
    let subtotal = 0;
    let taxTotal = 0;
    let costTotal = 0;
    let priceTotal = 0;

    // Calculate totals and verify stock availability
    for (const item of cartItems) {
      const dbProd = await db.products.get(item.product.id!);
      if (!dbProd) throw new Error(`Product ${item.product.name} not found!`);
      if (dbProd.stockQuantity < item.quantity) {
        throw new Error(`Insufficient stock for ${item.product.name}. Available: ${dbProd.stockQuantity}`);
      }
      
      const lineTaxableAmount = (item.product.sellingPrice - item.discount) * item.quantity;
      const lineTax = lineTaxableAmount * (item.product.taxRate / 100);
      
      subtotal += lineTaxableAmount;
      taxTotal += lineTax;
      costTotal += item.product.costPrice * item.quantity;
      priceTotal += item.product.sellingPrice * item.quantity;
    }

    const totalAmount = subtotal + taxTotal;
    const profitAmount = subtotal - costTotal;

    const paymentStatus = paymentMode === 'Credit' ? 'Unpaid' : 'Paid';

    // 1. Create Sale Entry
    const saleId = await db.sales.add({
      invoiceNo,
      dateTime: new Date(),
      customerId,
      customerName,
      totalAmount,
      discountAmount: discountTotal,
      taxAmount: taxTotal,
      profitAmount,
      paymentMode,
      paymentModeDetails,
      paymentStatus,
      status: 'Completed',
      cashierId,
    });

    // 2. Create SaleItems & Decrement Stock
    for (const item of cartItems) {
      const lineTaxableAmount = (item.product.sellingPrice - item.discount) * item.quantity;
      const lineTax = lineTaxableAmount * (item.product.taxRate / 100);
      
      await db.saleItems.add({
        saleId,
        productId: item.product.id!,
        productName: item.product.name,
        quantity: item.quantity,
        costPrice: item.product.costPrice,
        sellingPrice: item.product.sellingPrice,
        taxRate: item.product.taxRate,
        discountAmount: item.discount * item.quantity,
        totalAmount: lineTaxableAmount + lineTax,
      });

      // Update product stock
      const updatedStock = item.product.stockQuantity - item.quantity;
      await db.products.update(item.product.id!, { stockQuantity: updatedStock });
    }

    // 3. If credit (Udhar), update customer dues & ledger
    if (paymentMode === 'Credit' && customerId && customerId !== 0) {
      const customer = await db.customers.get(customerId);
      if (customer) {
        const newDue = customer.outstandingDue + totalAmount;
        if (customer.creditLimit > 0 && newDue > customer.creditLimit) {
          throw new Error(`Credit limit of ₹${customer.creditLimit} exceeded. Current outstanding + new sale: ₹${newDue}`);
        }
        await db.customers.update(customerId, { outstandingDue: newDue });
        await db.customerLedger.add({
          customerId,
          dateTime: new Date(),
          type: 'Sale',
          amount: totalAmount,
          balance: newDue,
          notes: `Debited for Invoice #${invoiceNo}`,
        });
      }
    }

    // 4. Record Cash Drawer change if paid cash
    if (paymentMode === 'Cash' || paymentMode === 'Split') {
      let cashReceived = totalAmount;
      if (paymentMode === 'Split') {
        // extract Cash from Split details, e.g. "Cash: 500, UPI: 300"
        const cashMatch = paymentModeDetails.match(/Cash:\s*([\d.]+)/);
        if (cashMatch) cashReceived = parseFloat(cashMatch[1]);
      }
      await db.cashDrawer.add({
        dateTime: new Date(),
        type: 'Cash In',
        amount: cashReceived,
        cashierId,
        notes: `Customer sale Cash received. Invoice #${invoiceNo}`,
      });
    }

    // 5. Add Audit Log
    await db.auditLogs.add({
      dateTime: new Date(),
      userId: cashierId,
      userRole,
      action: 'Create Sale',
      details: `Completed checkout for Invoice #${invoiceNo}. Customer: ${customerName}, Total: ₹${totalAmount.toFixed(2)}, Payment: ${paymentMode}`,
    });

    return saleId;
  });
}

export async function executePurchaseTransaction(
  poNo: string,
  supplierId: number,
  supplierName: string,
  purchaseItems: { product: Product; quantity: number; costPrice: number }[],
  paymentStatus: 'Paid' | 'Unpaid' | 'Partial',
  notes: string,
  cashierId: string,
  userRole: string
): Promise<number> {
  return await db.transaction('rw', [db.products, db.purchases, db.purchaseItems, db.suppliers, db.supplierLedger, db.auditLogs], async () => {
    let totalAmount = 0;
    for (const item of purchaseItems) {
      totalAmount += item.costPrice * item.quantity;
    }

    // 1. Create Purchase Entry
    const purchaseId = await db.purchases.add({
      poNo,
      supplierId,
      supplierName,
      dateTime: new Date(),
      totalAmount,
      paymentStatus,
      status: 'Received',
    });

    // 2. Create PurchaseItems & Increment Stock
    for (const item of purchaseItems) {
      await db.purchaseItems.add({
        purchaseId,
        productId: item.product.id!,
        productName: item.product.name,
        quantity: item.quantity,
        costPrice: item.costPrice,
        totalAmount: item.costPrice * item.quantity,
      });

      // Update product cost price (average cost or latest cost) and stock
      const dbProd = await db.products.get(item.product.id!);
      if (dbProd) {
        const newStock = dbProd.stockQuantity + item.quantity;
        await db.products.update(item.product.id!, {
          stockQuantity: newStock,
          costPrice: item.costPrice, // Update to latest purchase cost
        });
      }
    }

    // 3. Create Ledger Entry for Supplier if Unpaid or Partial
    if (paymentStatus !== 'Paid') {
      const unpaidAmount = totalAmount; // For simplicity in seeding / drafting
      // Get current ledger balance or default to 0
      const ledgerEntries = await db.supplierLedger.where('supplierId').equals(supplierId).sortBy('dateTime');
      const currentBalance = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].balance : 0;
      const newBalance = currentBalance + unpaidAmount;

      await db.supplierLedger.add({
        supplierId,
        dateTime: new Date(),
        type: 'Purchase',
        amount: unpaidAmount,
        balance: newBalance,
        notes: `Credited for Stock Purchase PO #${poNo}`,
      });
    }

    // 4. Add Audit Log
    await db.auditLogs.add({
      dateTime: new Date(),
      userId: cashierId,
      userRole,
      action: 'Purchase Order Received',
      details: `Received inventory for PO #${poNo} from ${supplierName}. Total Cost: ₹${totalAmount.toFixed(2)}. Remarks: ${notes}`,
    });

    return purchaseId;
  });
}

export async function executeSettleCustomerDue(
  customerId: number,
  amountPaid: number,
  notes: string,
  cashierId: string,
  userRole: string
): Promise<void> {
  await db.transaction('rw', [db.customers, db.customerLedger, db.cashDrawer, db.auditLogs], async () => {
    const customer = await db.customers.get(customerId);
    if (!customer) throw new Error('Customer not found');
    if (amountPaid <= 0) throw new Error('Settlement amount must be positive');

    const newOutstandingDue = customer.outstandingDue - amountPaid;
    await db.customers.update(customerId, { outstandingDue: newOutstandingDue });

    // Ledger record (negative amount indicates debt reduction)
    await db.customerLedger.add({
      customerId,
      dateTime: new Date(),
      type: 'Payment',
      amount: -amountPaid,
      balance: newOutstandingDue,
      notes: notes || 'Credit Dues Settlement Payment',
    });

    // Cash drawer record
    await db.cashDrawer.add({
      dateTime: new Date(),
      type: 'Cash In',
      amount: amountPaid,
      cashierId,
      notes: `Credit Settlement from ${customer.name}. Notes: ${notes}`,
    });

    // Audit log
    await db.auditLogs.add({
      dateTime: new Date(),
      userId: cashierId,
      userRole,
      action: 'Customer Due Settlement',
      details: `Settled credit debt for ${customer.name}. Amount Paid: ₹${amountPaid.toFixed(2)}. New outstanding: ₹${newOutstandingDue.toFixed(2)}`,
    });
  });
}
