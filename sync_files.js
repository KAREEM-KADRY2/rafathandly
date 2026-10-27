const fs = require('fs');
const path = require('path');

const src = 'C:\\Users\\xps\\Desktop\\الحاج رفعت\\الحاج رفعت';
const client = 'C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل\\الحاج رفعت';
const khas = 'C:\\Users\\xps\\Desktop\\خاص\\الحاج رفعت';

const filesToCopy = [
  'backend/src/controllers/reportsV2Controller.js',
  'backend/src/routes/reportsV2.js',
  'backend/src/controllers/purchaseController.js',
  'backend/src/purchaseController.js',
  'backend/src/routes/purchases.js',
  'backend/src/controllers/supplierController.js',
  'backend/src/routes/suppliers.js',
  'backend/src/controllers/creditSaleController.js',
  'backend/src/creditSaleController.js',
  'backend/src/controllers/customerController.js',
  'backend/src/customerController.js',
  'backend/src/routes/creditSales.js',
  'backend/src/controllers/treasuryController.js',
  'backend/src/treasuryController.js',
  'backend/src/routes/treasury.js',
  'frontend/src/pages/Treasury.jsx',
  'frontend/src/components/TreasuryVoucherModal.jsx',
  'frontend/src/components/AccountDetailsModal.jsx',
  'frontend/src/components/reports/ReportSummary.jsx',
  'frontend/src/components/reports/PartnersTable.jsx',
  'frontend/src/components/reports/SalesTable.jsx',
  'frontend/src/components/reports/PurchasesTable.jsx',
  'frontend/src/components/reports/ExpensesTable.jsx',
  'frontend/src/components/reports/CustomersTable.jsx',
  'frontend/src/components/reports/SuppliersTable.jsx',
  'frontend/src/components/reports/ProductsTable.jsx',
  'frontend/src/components/reports/InventoryMovementsTable.jsx',
  'frontend/src/utils/reportExportHelper.js',
  'frontend/src/pages/Reports.jsx',
  'frontend/src/pages/PartnershipDashboard.jsx',
  'frontend/src/pages/SupplierDetails.jsx',
  'frontend/src/components/PurchaseInvoiceDetailsModal.jsx',
  'frontend/src/components/PurchaseDetailsModal.jsx',
  'frontend/src/components/SaleDetailsModal.jsx',
  'frontend/src/components/WhatsappInvoiceModal.jsx',
  'frontend/src/components/RecordPurchaseModal.jsx',
  'frontend/src/components/EditPurchaseModal.jsx',
  'frontend/src/components/WorkerStatementModal.jsx',
  'frontend/src/pages/WorkerDetails.jsx',
  'frontend/src/pages/WorkersList.jsx',
  'frontend/public/logo.jpg',
  'frontend/src/components/ZaraAdjustmentModal.jsx',
  'frontend/src/pages/CustomerDetails.jsx',
  'frontend/src/pages/CustomersList.jsx',
  'frontend/src/components/NetProfitSection.jsx',
  'frontend/src/pages/SupplierDetails.jsx',
  'frontend/src/pages/SuppliersList.jsx',
  'frontend/src/pages/SalesList.jsx',
  'frontend/src/pages/Treasury.jsx',
  'backend/src/db/index.js'
];

for (const f of filesToCopy) {
  const sourcePath = path.join(src, f);
  if (!fs.existsSync(sourcePath)) {
    console.error(`Missing source: ${sourcePath}`);
    continue;
  }
  const clientDest = path.join(client, f);
  const khasDest = path.join(khas, f);

  fs.mkdirSync(path.dirname(clientDest), { recursive: true });
  fs.mkdirSync(path.dirname(khasDest), { recursive: true });

  fs.copyFileSync(sourcePath, clientDest);
  fs.copyFileSync(sourcePath, khasDest);
  console.log(`Successfully copied: ${f}`);
}
console.log('Sync completed successfully.');
