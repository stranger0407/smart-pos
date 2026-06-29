# Smart POS - Store Owner's Operational Manual

Welcome to **Smart POS**, a premium, local-first retail operating system designed for small to medium grocery shops, supermarkets, boutiques, apparel hubs, and local retail stores. This manual covers the core uses, business benefits, and step-by-step workflows for store owners.

---

## 1. Core Uses of Smart POS

Smart POS replaces paper ledgers (bahi-khata), excel sheets, and slow desktop billing machines with a single unified screen. You can use it to:
1. **Accelerate Checkouts**: Process customer payments in seconds using barcode scanners or type-to-search.
2. **Track Real-Time Stock**: Always know what is on the shelves, what is reserved, and what is out of stock.
3. **Manage Customer Credits (Khata Book)**: Keep track of customer dues ("udhar") with credit limits and date-wise payment logs.
4. **Log Supplier Purchases**: Record stock arrivals (restocking purchases) and update cost prices and supplier ledgers.
5. **Analyze Profits & Taxes**: Monitor daily/monthly sales, gross profit margins, and GST (CGST/SGST) collections.
6. **Download System Backups**: Export your entire database to a JSON file to transfer or backup data.

---

## 2. Key Business Benefits

* **100% Offline-Friendly**: The system stores all data locally in the browser (IndexedDB). Your cash counter **never stops working**, even during network outages.
* **Zero Hosting Costs**: Deployed as a static application on AWS (secured with HTTPS), it has no monthly server or database subscription fees.
* **Cashier Theft Prevention**: The system creates a strict **Audit Trail** of every price change, stock adjustment, and terminal login.
* **Auto-Calculated GST**: Supports item-wise tax categories (0%, 5%, 12%, 18%, 28%) and splits tax calculations on printouts automatically.
* **Credit Limit Safeguards**: Blocks cashiers from selling on credit to walk-in customers or exceeding a customer's credit threshold.

---

## 3. Step-by-Step Owner Daily Workflow

### A. Morning: System Check & Opening
1. **Passcode Login**: Access the terminal using PIN **`1111`** (Owner role). 
2. **Dashboard Overview**: Check the **Command Center** for key metrics:
   - *Total Outstanding Dues*: See how much credit money is owed to you.
   - *Stock Alerts*: View low stock count immediately.
3. **Store Header Setup**: Go to **System Settings**. Fill in your **Store Name**, **Address**, **Phone**, and **GSTIN**. These details are saved in local storage and will appear on printed invoices.

### B. Inventory Setup & Restocking
1. **Add Products**: Go to **Physical Stock** -> click **Register New Product**. Type in the name, SKU, barcode, category, cost price, selling price, and GST rate.
2. **Automated Restocking**:
   - Go to **Supply Chain** -> check the **Reorder Warning** alert banner.
   - Under the *Suppliers Directory* tab, click **Auto PO** next to a supplier (e.g. *Supreme Distributors*).
   - The system automatically drafts a Purchase Order containing all low-stock items linked to that vendor.
   - Adjust quantities, select payment status (*Paid / Unpaid*), and click **Submit Purchase Order** to update your stock immediately.

### C. Daytime: High-Speed Billing Operations
1. **Billing Desk**: If a cashier (PIN **`3333`**) logs in, they are directed straight here.
2. **Scan/Search**: Type/scan a barcode in the *Barcode* field and press Enter (or click a product card) to add it to the cart.
3. **Manage Cart**: You can edit quantities, apply discounts, or select a customer.
4. **Hold / Resume**: If a customer needs to grab another item, click the **Pause (Hold)** button to save their cart in the background, check out the next customer, and click **Play (Resume)** later to reload it.
5. **Checkout**: Select the payment mode (Cash, Card, UPI, Credit, Split).
   - *Split*: Enter specific Cash and UPI shares (e.g., ₹200 cash and ₹350 UPI).
   - *Credit (Udhar)*: Blocks checkout if Walk-in is selected or if the purchase exceeds the customer's limit.
6. **Print / Share**: Once you click *Charge*, a preview modal opens. Choose **Thermal Receipt** (for 3-inch slip printers) or **Standard A4 GST** (for full laser printers) and click **Print Invoice**.

### D. Managing Dues (Khata Book)
1. **Review Credit**: Go to **Credit Ledger**. Select a customer account (e.g., *Rahul Sharma*) to see their outstanding dues and invoice history.
2. **Collect Payments**: When a customer comes back to pay off their debt, click **Settle Payment**. Type the amount received (e.g., ₹1,000) and add notes.
3. **Automated Ledger Logging**: The system debits their dues balance, creates a cash drawer entry, and logs the transaction history.

### E. Evening: Audit, P&L, & Backup
1. **Review Reports**: Open **Reports & P&L** (restricted to Owner and Accountant roles) to view today's revenue, gross profits, discount claims, and tax breakdown.
2. **Security Audit**: Go to **System Settings** -> scroll through the **Security Activity Audit Trails** to verify cashier logins and manual stock adjustments.
3. **Backup Export**: Under **Settings**, click **Export Database JSON Backup** to download a local copy of your entire store data. Store this file on a secure USB drive.

---

## 4. Default Terminal Login Directories

Keep this list handy for your staff:

| Staff Role | Passcode (PIN) | Access Scope |
| :--- | :--- | :--- |
| **Owner** | `1111` | Full Access (All modules, margins, Settings, DB imports/resets) |
| **Admin** | `2222` | Management (Stock editing, ledger profiles, POs, no profit reports) |
| **Cashier** | `3333` | Counter Billing Desk only (No product edits, no stock adjustments, no reports) |
| **Inventory** | `4444` | Supply Chain & Stock adjustments (No billing desk, no reports) |
| **Accountant** | `5555` | Ledger audit, tax reports, P&L sheets (No stock editing, no billing) |
