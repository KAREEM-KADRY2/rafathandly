import * as XLSX from 'xlsx';

// Helper formatters
export const formatEGP = (val) => {
  const num = Number(val) || 0;
  return num.toLocaleString('ar-EG') + ' ج.م';
};

export const safeDateStr = (d) => {
  if (!d) return '-';
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString('ar-EG');
  } catch {
    return '-';
  }
};

/**
 * Standardize report data extraction across all report types
 */
export function extractReportData(reportType, data) {
  if (!data) return { rows: [], summaryItems: [], totals: {} };

  let rows = [];
  let summaryItems = [];
  let totals = {};

  switch (reportType) {
    case 'sales': {
      const list = Array.isArray(data.sales) ? data.sales : (Array.isArray(data) ? data : []);
      let sumAmount = 0, sumPaid = 0, sumRemaining = 0, sumCost = 0, sumProfit = 0, sumItems = 0;

      rows = list.map((r, i) => {
        const amount = Number(r.original_amount || r.total_amount || 0);
        const paid = Number(r.paid_amount || 0);
        const remaining = Number(r.remaining_amount || 0);
        const cost = Number(r.cost || r.total_cost || 0);
        const profit = Number(r.profit || 0);
        const items = Number(r.items_count || 0);

        sumAmount += amount;
        sumPaid += paid;
        sumRemaining += remaining;
        sumCost += cost;
        sumProfit += profit;
        sumItems += items;

        return {
          idx: i + 1,
          date: safeDateStr(r.sale_date || r.created_at),
          invoiceNo: r.invoice_number || r.id,
          name: r.customer_name || 'عميل نقدي',
          itemsCount: items,
          amount,
          paid,
          remaining,
          cost,
          profit
        };
      });

      totals = {
        count: rows.length,
        itemsCount: sumItems,
        amount: sumAmount,
        paid: sumPaid,
        remaining: sumRemaining,
        cost: sumCost,
        profit: sumProfit
      };

      summaryItems = [
        { label: 'إجمالي المبيعات', value: formatEGP(data.summary?.total_sales ?? sumAmount), num: data.summary?.total_sales ?? sumAmount, color: 'blue' },
        { label: 'إجمالي المدفوع', value: formatEGP(data.summary?.total_paid ?? sumPaid), num: data.summary?.total_paid ?? sumPaid, color: 'emerald' },
        { label: 'إجمالي المتبقي (مديونية)', value: formatEGP(data.summary?.total_remaining ?? sumRemaining), num: data.summary?.total_remaining ?? sumRemaining, color: 'rose' },
        { label: 'إجمالي التكلفة', value: formatEGP(data.summary?.total_cost ?? sumCost), num: data.summary?.total_cost ?? sumCost, color: 'slate' },
        { label: 'صافي أرباح المبيعات', value: formatEGP(data.summary?.total_profit ?? sumProfit), num: data.summary?.total_profit ?? sumProfit, color: 'teal' },
        { label: 'عدد الفواتير', value: `${data.summary?.count ?? rows.length} فاتورة`, num: data.summary?.count ?? rows.length, color: 'indigo' },
      ];
      break;
    }

    case 'purchases': {
      const list = Array.isArray(data.purchases) ? data.purchases : (Array.isArray(data) ? data : []);
      let sumAmount = 0, sumPaid = 0, sumRemaining = 0, sumItems = 0;

      rows = list.map((r, i) => {
        const amount = Number(r.original_amount || r.total_amount || 0);
        const paid = Number(r.paid_amount || 0);
        const remaining = Number(r.remaining_amount || 0);
        const items = Number(r.items_count || 0);

        sumAmount += amount;
        sumPaid += paid;
        sumRemaining += remaining;
        sumItems += items;

        return {
          idx: i + 1,
          date: safeDateStr(r.purchase_date || r.created_at),
          invoiceNo: r.invoice_number || r.id,
          name: r.supplier_name || 'مورد غير محدد',
          itemsCount: items,
          amount,
          paid,
          remaining
        };
      });

      totals = {
        count: rows.length,
        itemsCount: sumItems,
        amount: sumAmount,
        paid: sumPaid,
        remaining: sumRemaining
      };

      summaryItems = [
        { label: 'إجمالي المشتريات', value: formatEGP(data.summary?.total_purchases ?? sumAmount), num: data.summary?.total_purchases ?? sumAmount, color: 'blue' },
        { label: 'إجمالي المدفوع للموردين', value: formatEGP(data.summary?.total_paid ?? sumPaid), num: data.summary?.total_paid ?? sumPaid, color: 'emerald' },
        { label: 'إجمالي المتبقي (مستحقات)', value: formatEGP(data.summary?.total_remaining ?? sumRemaining), num: data.summary?.total_remaining ?? sumRemaining, color: 'rose' },
        { label: 'عدد فواتير الشراء', value: `${data.summary?.count ?? rows.length} فاتورة`, num: data.summary?.count ?? rows.length, color: 'indigo' },
      ];
      break;
    }

    case 'profit-loss': {
      const totalSales = Number(data.total_sales || 0);
      const cogs = Number(data.cogs || 0);
      const grossProfit = data.gross_profit !== undefined ? Number(data.gross_profit) : (totalSales - cogs);
      const expenses = Number(data.expenses || 0);
      const netProfit = data.net_profit !== undefined ? Number(data.net_profit) : (grossProfit - expenses);
      const breakdown = data.breakdown || {};
      const margin = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) + '%' : '0%';

      summaryItems = [
        { label: 'إجمالي المبيعات', value: formatEGP(totalSales), num: totalSales, color: 'blue' },
        { label: 'تكلفة البضاعة المباعة (COGS)', value: formatEGP(cogs), num: cogs, color: 'amber' },
        { label: 'مجمل الربح', value: formatEGP(grossProfit), num: grossProfit, color: 'emerald' },
        { label: 'إجمالي المصروفات', value: formatEGP(expenses), num: expenses, color: 'rose' },
        { label: 'صافي الربح النهائي', value: formatEGP(netProfit), num: netProfit, color: netProfit >= 0 ? 'emerald' : 'rose' },
        { label: 'هامش صافي الربح', value: margin, color: 'purple' },
      ];

      rows = [
        { statement: 'إيرادات المبيعات الإجمالية', amount: totalSales, ratio: '100%' },
        { statement: '(-) تكلفة البضاعة المباعة (COGS)', amount: cogs, ratio: totalSales > 0 ? ((cogs / totalSales) * 100).toFixed(1) + '%' : '-' },
        { statement: '(=) مجمل الربح التشغيلي', amount: grossProfit, ratio: totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) + '%' : '-' },
        { statement: '(-) إجمالي المصروفات العمومية والتشغيلية', amount: expenses, ratio: totalSales > 0 ? ((expenses / totalSales) * 100).toFixed(1) + '%' : '-' },
        { statement: '(=) صافي الربح النهائي للنشاط', amount: netProfit, ratio: margin, isTotal: true },
      ];

      totals = {
        totalSales,
        cogs,
        grossProfit,
        expenses,
        netProfit,
        breakdown
      };
      break;
    }

    case 'expenses': {
      const list = Array.isArray(data.expenses) ? data.expenses : (Array.isArray(data) ? data : []);
      let sumAmount = 0;

      rows = list.map((r, i) => {
        const amount = Number(r.amount || 0);
        sumAmount += amount;
        return {
          idx: i + 1,
          date: safeDateStr(r.date || r.created_at),
          type: r.expense_type || 'مصروف عام',
          description: r.description || '-',
          amount,
          ref: r.reference_number || '-'
        };
      });

      totals = {
        count: rows.length,
        amount: sumAmount
      };

      summaryItems = [
        { label: 'إجمالي المصروفات', value: formatEGP(data.summary?.total_expenses ?? sumAmount), num: data.summary?.total_expenses ?? sumAmount, color: 'rose' },
        { label: 'عدد العمليات المسجلة', value: `${rows.length} عملية`, num: rows.length, color: 'indigo' },
      ];
      break;
    }

    case 'inventory-movements': {
      const list = Array.isArray(data) ? data : (Array.isArray(data.movements) ? data.movements : []);
      let inCount = 0, outCount = 0, sumQty = 0;

      rows = list.map((r, i) => {
        const qty = Number(r.quantity || 0);
        const isEntry = (r.movement_type === 'IN' || qty > 0);
        if (isEntry) inCount++; else outCount++;
        sumQty += Math.abs(qty);

        return {
          idx: i + 1,
          date: safeDateStr(r.movement_date || r.created_at),
          productName: r.product_name || r.item_name || '-',
          movementType: isEntry ? 'وارد (إضافة مخزن)' : 'منصرف (سحب/بيع)',
          quantity: qty,
          ref: r.reference_id || '-'
        };
      });

      totals = {
        count: rows.length,
        inCount,
        outCount,
        sumQty
      };

      summaryItems = [
        { label: 'إجمالي حركات المخزون', value: `${rows.length} حركة`, num: rows.length, color: 'blue' },
        { label: 'حركات الوارد', value: `${inCount} حركة`, num: inCount, color: 'emerald' },
        { label: 'حركات المنصرف', value: `${outCount} حركة`, num: outCount, color: 'amber' },
        { label: 'إجمالي الكميات المتداولة', value: sumQty.toLocaleString('ar-EG'), num: sumQty, color: 'purple' },
      ];
      break;
    }

    case 'all-products': {
      const list = Array.isArray(data) ? data : (Array.isArray(data.products) ? data.products : []);
      let sumCost = 0, sumRev = 0, sumProfit = 0, sumStock = 0;

      rows = list.map((r, i) => {
        const purchased = Number(r.purchased_qty || 0);
        const sold = Number(r.sold_qty || 0);
        const stock = r.current_stock !== undefined ? Number(r.current_stock) : Math.max(0, purchased - sold);
        const avgCost = Number(r.avg_unit_cost || 0);
        const pCost = Number(r.purchase_cost || 0);
        const sRev = Number(r.sales_revenue || 0);
        const profit = Number(r.profit || 0);

        sumCost += pCost;
        sumRev += sRev;
        sumProfit += profit;
        sumStock += stock;

        return {
          idx: i + 1,
          name: r.name || '-',
          purchasedQty: purchased,
          soldQty: sold,
          stockQty: stock,
          avgCost,
          purchaseCost: pCost,
          salesRevenue: sRev,
          profit
        };
      });

      totals = {
        count: rows.length,
        sumCost,
        sumRev,
        sumProfit,
        sumStock
      };

      summaryItems = [
        { label: 'إجمالي الأصناف المسجلة', value: `${rows.length} صنف`, num: rows.length, color: 'indigo' },
        { label: 'إجمالي تكلفة المشتريات', value: formatEGP(sumCost), num: sumCost, color: 'blue' },
        { label: 'إجمالي إيرادات المبيعات', value: formatEGP(sumRev), num: sumRev, color: 'emerald' },
        { label: 'إجمالي أرباح الأصناف', value: formatEGP(sumProfit), num: sumProfit, color: 'teal' },
      ];
      break;
    }

    case 'customers': {
      const list = Array.isArray(data) ? data : (Array.isArray(data.customers) ? data.customers : []);
      let sumOpen = 0, sumPurchases = 0, sumPaid = 0, sumRemaining = 0;

      rows = list.map((r, i) => {
        const invoices = Number(r.invoices_count || 0);
        const opening = Number(r.opening_balance || 0);
        const purchases = Number(r.total_purchases || 0);
        const paid = Number(r.total_paid || 0);
        const remaining = r.total_remaining !== undefined ? Number(r.total_remaining) : (opening + purchases - paid);

        sumOpen += opening;
        sumPurchases += purchases;
        sumPaid += paid;
        sumRemaining += remaining;

        return {
          idx: i + 1,
          name: r.name || '-',
          invoicesCount: invoices,
          opening,
          purchases,
          paid,
          remaining
        };
      });

      totals = {
        count: rows.length,
        sumOpen,
        sumPurchases,
        sumPaid,
        sumRemaining
      };

      summaryItems = [
        { label: 'إجمالي الأرصدة الافتتاحية', value: formatEGP(data.summary?.total_opening ?? sumOpen), num: data.summary?.total_opening ?? sumOpen, color: 'indigo' },
        { label: 'إجمالي المسحوبات (المبيعات)', value: formatEGP(data.summary?.total_purchases ?? sumPurchases), num: data.summary?.total_purchases ?? sumPurchases, color: 'blue' },
        { label: 'إجمالي المحصل من العملاء', value: formatEGP(data.summary?.total_paid ?? sumPaid), num: data.summary?.total_paid ?? sumPaid, color: 'emerald' },
        { label: 'صافي المديونيات المتبقية', value: formatEGP(data.summary?.total_remaining ?? sumRemaining), num: data.summary?.total_remaining ?? sumRemaining, color: 'rose' },
        { label: 'إجمالي عدد العملاء', value: `${rows.length} عميل`, num: rows.length, color: 'slate' },
      ];
      break;
    }

    case 'suppliers': {
      const list = Array.isArray(data) ? data : (Array.isArray(data.suppliers) ? data.suppliers : []);
      let sumOpen = 0, sumPurchases = 0, sumPaid = 0, sumRemaining = 0;

      rows = list.map((r, i) => {
        const invoices = Number(r.invoices_count || 0);
        const opening = Number(r.opening_balance || 0);
        const purchases = Number(r.total_purchases || 0);
        const paid = Number(r.total_paid || 0);
        const remaining = r.total_remaining !== undefined ? Number(r.total_remaining) : (opening + purchases - paid);

        sumOpen += opening;
        sumPurchases += purchases;
        sumPaid += paid;
        sumRemaining += remaining;

        return {
          idx: i + 1,
          name: r.name || '-',
          invoicesCount: invoices,
          opening,
          purchases,
          paid,
          remaining
        };
      });

      totals = {
        count: rows.length,
        sumOpen,
        sumPurchases,
        sumPaid,
        sumRemaining
      };

      summaryItems = [
        { label: 'إجمالي الأرصدة الافتتاحية', value: formatEGP(data.summary?.total_opening ?? sumOpen), num: data.summary?.total_opening ?? sumOpen, color: 'indigo' },
        { label: 'إجمالي المشتريات من الموردين', value: formatEGP(data.summary?.total_purchases ?? sumPurchases), num: data.summary?.total_purchases ?? sumPurchases, color: 'blue' },
        { label: 'إجمالي المدفوع للموردين', value: formatEGP(data.summary?.total_paid ?? sumPaid), num: data.summary?.total_paid ?? sumPaid, color: 'emerald' },
        { label: 'صافي المستحقات المتبقية', value: formatEGP(data.summary?.total_remaining ?? sumRemaining), num: data.summary?.total_remaining ?? sumRemaining, color: 'rose' },
        { label: 'إجمالي عدد الموردين', value: `${rows.length} مورد`, num: rows.length, color: 'slate' },
      ];
      break;
    }

    case 'partners': {
      const list = Array.isArray(data?.partners) ? data.partners : [];
      let sumCapital = 0, sumWithdrawn = 0, sumReturned = 0, sumNet = 0, sumBalance = 0;

      rows = list.map((r, i) => {
        const percentage = Number(r.percentage !== undefined ? r.percentage : (r.share_percentage || 0));
        const capital = Number(r.capital_contribution !== undefined ? r.capital_contribution : (r.capital || 0));
        const withdrawn = Number(r.total_withdrawals || 0);
        const returned = Number(r.total_returned || 0);
        const net = Number(r.net_withdrawals !== undefined ? r.net_withdrawals : (withdrawn - returned));
        const balance = Number(r.current_balance !== undefined ? r.current_balance : (capital - net));

        sumCapital += capital;
        sumWithdrawn += withdrawn;
        sumReturned += returned;
        sumNet += net;
        sumBalance += balance;

        return {
          idx: i + 1,
          name: r.name || '-',
          percentage: `${percentage}%`,
          capital,
          withdrawn,
          returned,
          net,
          transactions: Number(r.transactions_count || 0),
          balance,
          status: (r.status === 'archived' || r.is_active === 0) ? 'مؤرشف' : 'نشط'
        };
      });

      totals = {
        count: rows.length,
        sumCapital,
        sumWithdrawn,
        sumReturned,
        sumNet,
        sumBalance
      };

      summaryItems = [
        { label: 'إجمالي رأس مال الشركاء', value: formatEGP(data.summary?.total_capital ?? sumCapital), num: data.summary?.total_capital ?? sumCapital, color: 'blue' },
        { label: 'إجمالي المسحوبات', value: formatEGP(data.summary?.total_withdrawals ?? sumWithdrawn), num: data.summary?.total_withdrawals ?? sumWithdrawn, color: 'rose' },
        { label: 'المبالغ المرتجعة للخزينة', value: formatEGP(data.summary?.total_returned ?? sumReturned), num: data.summary?.total_returned ?? sumReturned, color: 'teal' },
        { label: 'صافي المسحوبات الحقيقية', value: formatEGP(data.summary?.net_withdrawals ?? sumNet), num: data.summary?.net_withdrawals ?? sumNet, color: 'amber' },
        { label: 'صافي رصيد الشركاء', value: formatEGP(data.summary?.total_balance ?? sumBalance), num: data.summary?.total_balance ?? sumBalance, color: 'indigo' },
        { label: 'عدد الشركاء المسجلين', value: `${rows.length} شريك`, num: rows.length, color: 'slate' },
      ];
      break;
    }

    default:
      break;
  }

  return { rows, summaryItems, totals };
}

/**
 * HIGH-GRADE EXCEL EXPORTER
 */
export function exportReportToExcel({ reportType, reportName, dateRange, data, settings }) {
  const { rows, summaryItems, totals } = extractReportData(reportType, data);
  if (!rows || (rows.length === 0 && reportType !== 'profit-loss')) {
    alert('لا توجد بيانات متاحة للتصدير');
    return;
  }

  const companyName = settings?.company_name || 'مجموعة الحاج رفعت';
  const periodText = (dateRange?.startDate && dateRange?.endDate)
    ? `من ${dateRange.startDate} إلى ${dateRange.endDate}`
    : 'كامل الفترات المسجلة';
  const exportDateText = new Date().toLocaleString('ar-EG');

  // Build Sheet AOA (Array of Arrays)
  const aoa = [];

  // 1. Company and Report Header
  aoa.push([companyName]);
  aoa.push([`تقرير ${reportName}`, `الفترة: ${periodText}`]);
  aoa.push([`تاريخ الاستخراج: ${exportDateText}`, `نظام الحسابات والإدارة`]);
  aoa.push([]); // blank line

  // 2. Executive Highlights Box (if applicable)
  if (summaryItems && summaryItems.length > 0) {
    aoa.push(['--- ملخص ومؤشرات التقرير المالي ---']);
    for (let i = 0; i < summaryItems.length; i += 2) {
      const item1 = summaryItems[i];
      const item2 = summaryItems[i + 1];
      const row = [];
      if (item1) {
        row.push(item1.label, typeof item1.num === 'number' ? item1.num : item1.value);
      }
      if (item2) {
        row.push('', item2.label, typeof item2.num === 'number' ? item2.num : item2.value);
      }
      aoa.push(row);
    }
    aoa.push([]); // blank line
  }

  // 3. Table Column Headers & Data
  let headers = [];
  let tableRows = [];
  let totalsRow = [];

  switch (reportType) {
    case 'sales':
      headers = ['م', 'تاريخ الفاتورة', 'رقم الفاتورة', 'اسم العميل', 'عدد العناصر', 'إجمالي الفاتورة', 'المبلغ المدفوع', 'المتبقي (مديونية)', 'التكلفة', 'الربح المحقق'];
      tableRows = rows.map(r => [r.idx, r.date, r.invoiceNo, r.name, r.itemsCount, r.amount, r.paid, r.remaining, r.cost, r.profit]);
      totalsRow = ['الإجمالي العام', '', '', '', totals.itemsCount, totals.amount, totals.paid, totals.remaining, totals.cost, totals.profit];
      break;

    case 'purchases':
      headers = ['م', 'تاريخ الشراء', 'رقم الفاتورة', 'اسم المورد / المصنع', 'عدد العناصر', 'إجمالي الفاتورة', 'المبلغ المدفوع', 'المتبقي (مستحق)'];
      tableRows = rows.map(r => [r.idx, r.date, r.invoiceNo, r.name, r.itemsCount, r.amount, r.paid, r.remaining]);
      totalsRow = ['الإجمالي العام', '', '', '', totals.itemsCount, totals.amount, totals.paid, totals.remaining];
      break;

    case 'profit-loss':
      headers = ['بيان الحساب في قائمة الدخل', 'المبلغ (ج.م)', 'النسبة المئوية % من المبيعات'];
      tableRows = rows.map(r => [r.statement, r.amount, r.ratio]);
      if (totals.breakdown) {
        tableRows.push([]);
        tableRows.push(['--- تفصيل المصروفات التشغيلية والعمومية ---', '', '']);
        tableRows.push(['مصروفات عامة وتشغيل', totals.breakdown.general_expenses || 0, '']);
        tableRows.push(['مسحوبات وسلف عمال', totals.breakdown.worker_withdrawals || 0, '']);
        tableRows.push(['مصروفات أخرى متنوعة', totals.breakdown.other_expenses || 0, '']);
      }
      break;

    case 'expenses':
      headers = ['م', 'تاريخ المصروف', 'تصنيف ونوع المصروف', 'البيان والتفاصيل', 'المبلغ', 'رقم المرجع / الإيصال'];
      tableRows = rows.map(r => [r.idx, r.date, r.type, r.description, r.amount, r.ref]);
      totalsRow = ['الإجمالي العام', '', '', '', totals.amount, ''];
      break;

    case 'inventory-movements':
      headers = ['م', 'التاريخ والوقت', 'اسم الصنف / المنتج', 'نوع الحركة', 'الكمية', 'رقم المرجع'];
      tableRows = rows.map(r => [r.idx, r.date, r.productName, r.movementType, r.quantity, r.ref]);
      totalsRow = ['إجمالي العمليات', '', '', '', totals.sumQty, ''];
      break;

    case 'all-products':
      headers = ['م', 'اسم الصنف', 'الكمية المشتراة', 'الكمية المباعة', 'الرصيد المتبقي بالمخزن', 'متوسط التكلفة', 'تكلفة الشراء', 'إيرادات البيع', 'الأرباح'];
      tableRows = rows.map(r => [r.idx, r.name, r.purchasedQty, r.soldQty, r.stockQty, r.avgCost, r.purchaseCost, r.salesRevenue, r.profit]);
      totalsRow = ['الإجمالي العام', '', '', '', totals.sumStock, '', totals.sumCost, totals.sumRev, totals.sumProfit];
      break;

    case 'customers':
      headers = ['م', 'اسم العميل', 'عدد الفواتير', 'الرصيد الافتتاحي', 'إجمالي المسحوبات (المبيعات)', 'الإجمالي المدفوع', 'الرصيد المتبقي (مديونية)'];
      tableRows = rows.map(r => [r.idx, r.name, r.invoicesCount, r.opening, r.purchases, r.paid, r.remaining]);
      totalsRow = ['الإجمالي العام', '', '', totals.sumOpen, totals.sumPurchases, totals.sumPaid, totals.sumRemaining];
      break;

    case 'suppliers':
      headers = ['م', 'اسم المورد / المصنع', 'عدد الفواتير', 'الرصيد الافتتاحي', 'إجمالي المشتريات', 'الإجمالي المدفوع', 'الرصيد المتبقي (مستحق للمورد)'];
      tableRows = rows.map(r => [r.idx, r.name, r.invoicesCount, r.opening, r.purchases, r.paid, r.remaining]);
      totalsRow = ['الإجمالي العام', '', '', totals.sumOpen, totals.sumPurchases, totals.sumPaid, totals.sumRemaining];
      break;

    case 'partners':
      headers = ['م', 'اسم الشريك', 'نسبة الشراكة', 'رأس المال المسجل', 'إجمالي المسحوبات', 'المرتجع للخزينة', 'صافي المسحوبات الحقيقية', 'عدد الحركات', 'الرصيد الفعلي الحالي', 'الحالة'];
      tableRows = rows.map(r => [r.idx, r.name, r.percentage, r.capital, r.withdrawn, r.returned, r.net, r.transactions, r.balance, r.status]);
      totalsRow = ['الإجمالي العام', '', '', totals.sumCapital, totals.sumWithdrawn, totals.sumReturned, totals.sumNet, '', totals.sumBalance, ''];
      break;

    default:
      break;
  }

  aoa.push(headers);
  for (const row of tableRows) {
    aoa.push(row);
  }
  if (totalsRow.length > 0) {
    aoa.push([]); // blank line before totals
    aoa.push(totalsRow);
  }

  // Generate Worksheet
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Set Auto Column Widths
  const colWidths = [];
  for (let c = 0; c < 15; c++) {
    let maxLen = 12;
    for (let r = 0; r < aoa.length; r++) {
      if (aoa[r] && aoa[r][c] !== undefined && aoa[r][c] !== null) {
        const valStr = String(aoa[r][c]);
        if (valStr.length > maxLen) {
          maxLen = Math.min(valStr.length, 45);
        }
      }
    }
    colWidths.push({ wch: maxLen + 4 });
  }
  ws['!cols'] = colWidths;

  // RTL Sheet View
  ws['!views'] = [{ rightToLeft: true }];

  // Create Workbook
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, reportName.substring(0, 31));

  const dateFileStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `تقرير_${reportName}_${dateFileStr}.xlsx`);
}

/**
 * HIGH-GRADE OFFICIAL PDF EXPORTER / PRINT ENGINE
 */
export function exportReportToPDF({ reportType, reportName, dateRange, data, settings }) {
  const { rows, summaryItems, totals } = extractReportData(reportType, data);
  if (!rows || (rows.length === 0 && reportType !== 'profit-loss')) {
    alert('لا توجد بيانات متاحة للتصدير');
    return;
  }

  const printWindow = window.open('', '_blank', 'height=900,width=1200');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة (Popups) في المتصفح لعرض وطباعة التقرير');
    return;
  }

  const companyName = settings?.company_name || 'مجموعة الحاج رفعت';
  const tagline = settings?.company_tagline || 'نظام إدارة الحسابات والتجارة المتكامل';
  const phone1 = settings?.company_phone1;
  const phone1Label = settings?.company_phone1_label || 'الإدارة';
  const phone2 = settings?.company_phone2;
  const phone2Label = settings?.company_phone2_label || 'الحسابات';
  const address = settings?.company_address;
  const logo = settings?.company_logo || '/logo.jpg';
  const showLogo = settings?.invoice_show_logo !== 'false' && settings?.invoice_show_logo !== false;

  const periodText = (dateRange?.startDate && dateRange?.endDate)
    ? `من ${dateRange.startDate} إلى ${dateRange.endDate}`
    : 'كامل الفترات المسجلة';

  // Orientation: Landscape for wide tables, portrait for profit-loss
  const isLandscape = reportType !== 'profit-loss' && reportType !== 'expenses';

  // Build Summary Cards HTML
  let summaryHtml = '';
  if (summaryItems && summaryItems.length > 0) {
    summaryHtml = `
      <div style="margin-bottom: 20px;" class="no-break">
        <h3 style="font-size: 13px; font-weight: 800; color: #1a2b4c; margin: 0 0 10px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">
          📊 المؤشرات المالية والملخص التنفيذي
        </h3>
        <div style="display: grid; grid-template-columns: repeat(${Math.min(summaryItems.length, 6)}, 1fr); gap: 10px;">
          ${summaryItems.map(item => `
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-top: 3px solid #1a2b4c; border-radius: 8px; padding: 8px 10px; text-align: center;">
              <span style="display: block; font-size: 11px; color: #64748b; font-weight: 700; margin-bottom: 4px;">${item.label}</span>
              <span style="display: block; font-size: 14px; font-weight: 900; color: #1a2b4c;" dir="ltr">${item.value}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Build Table HTML
  let tableHeadersHtml = '';
  let tableBodyHtml = '';
  let tableFootHtml = '';

  switch (reportType) {
    case 'sales':
      tableHeadersHtml = `
        <tr>
          <th style="width: 35px; text-align: center;">م</th>
          <th style="width: 85px;">التاريخ</th>
          <th style="width: 85px;">رقم الفاتورة</th>
          <th>اسم العميل</th>
          <th style="width: 60px; text-align: center;">الأصناف</th>
          <th style="width: 100px; text-align: center;">إجمالي الفاتورة</th>
          <th style="width: 100px; text-align: center;">المدفوع</th>
          <th style="width: 100px; text-align: center;">المتبقي</th>
          <th style="width: 95px; text-align: center;">التكلفة</th>
          <th style="width: 95px; text-align: center;">الربح</th>
        </tr>
      `;
      tableBodyHtml = rows.map(r => `
        <tr>
          <td style="text-align: center; color: #64748b;">${r.idx}</td>
          <td>${r.date}</td>
          <td style="font-weight: 700; color: #1d4ed8;">${r.invoiceNo}</td>
          <td style="font-weight: 700;">${r.name}</td>
          <td style="text-align: center;">${r.itemsCount}</td>
          <td style="text-align: center; font-weight: 800;" dir="ltr">${formatEGP(r.amount)}</td>
          <td style="text-align: center; font-weight: 700; color: #166534;" dir="ltr">${formatEGP(r.paid)}</td>
          <td style="text-align: center; font-weight: 800; color: ${r.remaining > 0 ? '#b91c1c' : '#64748b'};" dir="ltr">${formatEGP(r.remaining)}</td>
          <td style="text-align: center; color: #475569;" dir="ltr">${formatEGP(r.cost)}</td>
          <td style="text-align: center; font-weight: 800; color: #047857;" dir="ltr">${formatEGP(r.profit)}</td>
        </tr>
      `).join('');
      tableFootHtml = `
        <tr style="background: #e2e8f0; font-weight: 900; color: #0f172a;">
          <td colspan="4" style="text-align: right; padding: 10px;">الإجمالي العام لكافة المبيعات (${totals.count} فاتورة)</td>
          <td style="text-align: center;">${totals.itemsCount}</td>
          <td style="text-align: center;" dir="ltr">${formatEGP(totals.amount)}</td>
          <td style="text-align: center; color: #166534;" dir="ltr">${formatEGP(totals.paid)}</td>
          <td style="text-align: center; color: #b91c1c;" dir="ltr">${formatEGP(totals.remaining)}</td>
          <td style="text-align: center;" dir="ltr">${formatEGP(totals.cost)}</td>
          <td style="text-align: center; color: #047857;" dir="ltr">${formatEGP(totals.profit)}</td>
        </tr>
      `;
      break;

    case 'purchases':
      tableHeadersHtml = `
        <tr>
          <th style="width: 35px; text-align: center;">م</th>
          <th style="width: 90px;">التاريخ</th>
          <th style="width: 95px;">رقم الفاتورة</th>
          <th>اسم المورد / المصنع</th>
          <th style="width: 70px; text-align: center;">الأصناف</th>
          <th style="width: 120px; text-align: center;">إجمالي الفاتورة</th>
          <th style="width: 120px; text-align: center;">المدفوع</th>
          <th style="width: 120px; text-align: center;">المتبقي (مستحق)</th>
        </tr>
      `;
      tableBodyHtml = rows.map(r => `
        <tr>
          <td style="text-align: center; color: #64748b;">${r.idx}</td>
          <td>${r.date}</td>
          <td style="font-weight: 700; color: #1d4ed8;">${r.invoiceNo}</td>
          <td style="font-weight: 700;">${r.name}</td>
          <td style="text-align: center;">${r.itemsCount}</td>
          <td style="text-align: center; font-weight: 800;" dir="ltr">${formatEGP(r.amount)}</td>
          <td style="text-align: center; font-weight: 700; color: #166534;" dir="ltr">${formatEGP(r.paid)}</td>
          <td style="text-align: center; font-weight: 800; color: ${r.remaining > 0 ? '#b91c1c' : '#64748b'};" dir="ltr">${formatEGP(r.remaining)}</td>
        </tr>
      `).join('');
      tableFootHtml = `
        <tr style="background: #e2e8f0; font-weight: 900; color: #0f172a;">
          <td colspan="4" style="text-align: right; padding: 10px;">الإجمالي العام للمشتريات (${totals.count} فاتورة)</td>
          <td style="text-align: center;">${totals.itemsCount}</td>
          <td style="text-align: center;" dir="ltr">${formatEGP(totals.amount)}</td>
          <td style="text-align: center; color: #166534;" dir="ltr">${formatEGP(totals.paid)}</td>
          <td style="text-align: center; color: #b91c1c;" dir="ltr">${formatEGP(totals.remaining)}</td>
        </tr>
      `;
      break;

    case 'profit-loss':
      tableHeadersHtml = `
        <tr>
          <th>بيان قائمة الدخل والأرباح</th>
          <th style="width: 160px; text-align: center;">المبلغ (ج.م)</th>
          <th style="width: 140px; text-align: center;">النسبة المئوية %</th>
        </tr>
      `;
      tableBodyHtml = rows.map(r => `
        <tr style="${r.isTotal ? 'background: #f1f5f9; font-weight: 900;' : ''}">
          <td style="font-weight: ${r.isTotal ? '900' : '700'}; font-size: ${r.isTotal ? '14px' : '12px'}; color: ${r.isTotal ? '#1a2b4c' : '#1e293b'};">
            ${r.statement}
          </td>
          <td style="text-align: center; font-weight: 800; font-size: ${r.isTotal ? '15px' : '13px'}; color: ${r.amount >= 0 ? '#166534' : '#b91c1c'};" dir="ltr">
            ${formatEGP(r.amount)}
          </td>
          <td style="text-align: center; font-weight: 700; color: #475569;">${r.ratio}</td>
        </tr>
      `).join('');
      if (totals.breakdown) {
        tableFootHtml = `
          <tr style="background: #f8fafc;">
            <td colspan="3" style="padding: 12px;">
              <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; color: #1a2b4c;">تفصيل المصروفات التشغيلية والعمومية:</h4>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 11px;">
                <div style="background: #fff; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 6px;">
                  <span style="color: #64748b; font-weight: 600;">مصروفات عامة: </span>
                  <strong style="color: #1a2b4c;" dir="ltr">${formatEGP(totals.breakdown.general_expenses)}</strong>
                </div>
                <div style="background: #fff; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 6px;">
                  <span style="color: #64748b; font-weight: 600;">مسحوبات عمال: </span>
                  <strong style="color: #1a2b4c;" dir="ltr">${formatEGP(totals.breakdown.worker_withdrawals)}</strong>
                </div>
                <div style="background: #fff; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 6px;">
                  <span style="color: #64748b; font-weight: 600;">مصروفات أخرى: </span>
                  <strong style="color: #1a2b4c;" dir="ltr">${formatEGP(totals.breakdown.other_expenses)}</strong>
                </div>
              </div>
            </td>
          </tr>
        `;
      }
      break;

    case 'expenses':
      tableHeadersHtml = `
        <tr>
          <th style="width: 35px; text-align: center;">م</th>
          <th style="width: 100px;">التاريخ</th>
          <th style="width: 140px;">نوع المصروف</th>
          <th>البيان والتفاصيل</th>
          <th style="width: 130px; text-align: center;">المبلغ</th>
          <th style="width: 120px; text-align: center;">رقم المرجع</th>
        </tr>
      `;
      tableBodyHtml = rows.map(r => `
        <tr>
          <td style="text-align: center; color: #64748b;">${r.idx}</td>
          <td>${r.date}</td>
          <td style="font-weight: 700; color: #b91c1c;">${r.type}</td>
          <td>${r.description}</td>
          <td style="text-align: center; font-weight: 800; color: #b91c1c;" dir="ltr">${formatEGP(r.amount)}</td>
          <td style="text-align: center; color: #64748b;">${r.ref}</td>
        </tr>
      `).join('');
      tableFootHtml = `
        <tr style="background: #e2e8f0; font-weight: 900; color: #0f172a;">
          <td colspan="4" style="text-align: right; padding: 10px;">إجمالي المصروفات (${totals.count} عملية)</td>
          <td style="text-align: center; color: #b91c1c;" dir="ltr">${formatEGP(totals.amount)}</td>
          <td></td>
        </tr>
      `;
      break;

    case 'inventory-movements':
      tableHeadersHtml = `
        <tr>
          <th style="width: 35px; text-align: center;">م</th>
          <th style="width: 120px;">التاريخ والوقت</th>
          <th>اسم الصنف / المنتج</th>
          <th style="width: 140px; text-align: center;">نوع الحركة</th>
          <th style="width: 100px; text-align: center;">الكمية</th>
          <th style="width: 110px; text-align: center;">رقم المرجع</th>
        </tr>
      `;
      tableBodyHtml = rows.map(r => `
        <tr>
          <td style="text-align: center; color: #64748b;">${r.idx}</td>
          <td>${r.date}</td>
          <td style="font-weight: 700;">${r.productName}</td>
          <td style="text-align: center; font-weight: 700; color: ${r.movementType.includes('وارد') ? '#166534' : '#b45309'};">${r.movementType}</td>
          <td style="text-align: center; font-weight: 800;" dir="ltr">${r.quantity}</td>
          <td style="text-align: center; color: #64748b;">${r.ref}</td>
        </tr>
      `).join('');
      tableFootHtml = `
        <tr style="background: #e2e8f0; font-weight: 900; color: #0f172a;">
          <td colspan="4" style="text-align: right; padding: 10px;">إجمالي العمليات المتداولة (${totals.count} حركة)</td>
          <td style="text-align: center;" dir="ltr">${totals.sumQty}</td>
          <td></td>
        </tr>
      `;
      break;

    case 'all-products':
      tableHeadersHtml = `
        <tr>
          <th style="width: 35px; text-align: center;">م</th>
          <th>اسم المنتج / الصنف</th>
          <th style="width: 80px; text-align: center;">المشترى</th>
          <th style="width: 80px; text-align: center;">المباع</th>
          <th style="width: 90px; text-align: center;">الرصيد بالمخزن</th>
          <th style="width: 90px; text-align: center;">متوسط التكلفة</th>
          <th style="width: 110px; text-align: center;">تكلفة الشراء</th>
          <th style="width: 110px; text-align: center;">إيراد البيع</th>
          <th style="width: 100px; text-align: center;">الأرباح</th>
        </tr>
      `;
      tableBodyHtml = rows.map(r => `
        <tr>
          <td style="text-align: center; color: #64748b;">${r.idx}</td>
          <td style="font-weight: 700;">${r.name}</td>
          <td style="text-align: center;">${r.purchasedQty}</td>
          <td style="text-align: center;">${r.soldQty}</td>
          <td style="text-align: center; font-weight: 800; color: #1d4ed8;">${r.stockQty}</td>
          <td style="text-align: center;" dir="ltr">${formatEGP(r.avgCost)}</td>
          <td style="text-align: center;" dir="ltr">${formatEGP(r.purchaseCost)}</td>
          <td style="text-align: center; color: #166534; font-weight: 700;" dir="ltr">${formatEGP(r.salesRevenue)}</td>
          <td style="text-align: center; color: #047857; font-weight: 800;" dir="ltr">${formatEGP(r.profit)}</td>
        </tr>
      `).join('');
      tableFootHtml = `
        <tr style="background: #e2e8f0; font-weight: 900; color: #0f172a;">
          <td colspan="4" style="text-align: right; padding: 10px;">الإجمالي العام (${totals.count} صنف)</td>
          <td style="text-align: center; color: #1d4ed8;">${totals.sumStock}</td>
          <td></td>
          <td style="text-align: center;" dir="ltr">${formatEGP(totals.sumCost)}</td>
          <td style="text-align: center; color: #166534;" dir="ltr">${formatEGP(totals.sumRev)}</td>
          <td style="text-align: center; color: #047857;" dir="ltr">${formatEGP(totals.sumProfit)}</td>
        </tr>
      `;
      break;

    case 'customers':
      tableHeadersHtml = `
        <tr>
          <th style="width: 35px; text-align: center;">م</th>
          <th>اسم العميل</th>
          <th style="width: 80px; text-align: center;">الفواتير</th>
          <th style="width: 120px; text-align: center;">الرصيد الافتتاحي</th>
          <th style="width: 130px; text-align: center;">إجمالي المسحوبات</th>
          <th style="width: 120px; text-align: center;">المدفوع</th>
          <th style="width: 130px; text-align: center;">المتبقي (مديونية)</th>
        </tr>
      `;
      tableBodyHtml = rows.map(r => `
        <tr>
          <td style="text-align: center; color: #64748b;">${r.idx}</td>
          <td style="font-weight: 700;">${r.name}</td>
          <td style="text-align: center;">${r.invoicesCount}</td>
          <td style="text-align: center; color: #2563eb; font-weight: 700;" dir="ltr">${formatEGP(r.opening)}</td>
          <td style="text-align: center; font-weight: 800;" dir="ltr">${formatEGP(r.purchases)}</td>
          <td style="text-align: center; font-weight: 700; color: #166534;" dir="ltr">${formatEGP(r.paid)}</td>
          <td style="text-align: center; font-weight: 800; color: ${r.remaining > 0 ? '#b91c1c' : '#64748b'};" dir="ltr">${formatEGP(r.remaining)}</td>
        </tr>
      `).join('');
      tableFootHtml = `
        <tr style="background: #e2e8f0; font-weight: 900; color: #0f172a;">
          <td colspan="3" style="text-align: right; padding: 10px;">إجمالي حسابات العملاء (${totals.count} عميل)</td>
          <td style="text-align: center; color: #2563eb;" dir="ltr">${formatEGP(totals.sumOpen)}</td>
          <td style="text-align: center;" dir="ltr">${formatEGP(totals.sumPurchases)}</td>
          <td style="text-align: center; color: #166534;" dir="ltr">${formatEGP(totals.sumPaid)}</td>
          <td style="text-align: center; color: #b91c1c;" dir="ltr">${formatEGP(totals.sumRemaining)}</td>
        </tr>
      `;
      break;

    case 'suppliers':
      tableHeadersHtml = `
        <tr>
          <th style="width: 35px; text-align: center;">م</th>
          <th>اسم المورد / المصنع</th>
          <th style="width: 80px; text-align: center;">الفواتير</th>
          <th style="width: 120px; text-align: center;">الرصيد الافتتاحي</th>
          <th style="width: 130px; text-align: center;">إجمالي المشتريات</th>
          <th style="width: 120px; text-align: center;">المدفوع</th>
          <th style="width: 130px; text-align: center;">المتبقي (مستحق للمورد)</th>
        </tr>
      `;
      tableBodyHtml = rows.map(r => `
        <tr>
          <td style="text-align: center; color: #64748b;">${r.idx}</td>
          <td style="font-weight: 700;">${r.name}</td>
          <td style="text-align: center;">${r.invoicesCount}</td>
          <td style="text-align: center; color: #2563eb; font-weight: 700;" dir="ltr">${formatEGP(r.opening)}</td>
          <td style="text-align: center; font-weight: 800;" dir="ltr">${formatEGP(r.purchases)}</td>
          <td style="text-align: center; font-weight: 700; color: #166534;" dir="ltr">${formatEGP(r.paid)}</td>
          <td style="text-align: center; font-weight: 800; color: ${r.remaining > 0 ? '#b91c1c' : '#64748b'};" dir="ltr">${formatEGP(r.remaining)}</td>
        </tr>
      `).join('');
      tableFootHtml = `
        <tr style="background: #e2e8f0; font-weight: 900; color: #0f172a;">
          <td colspan="3" style="text-align: right; padding: 10px;">إجمالي حسابات الموردين (${totals.count} مورد)</td>
          <td style="text-align: center; color: #2563eb;" dir="ltr">${formatEGP(totals.sumOpen)}</td>
          <td style="text-align: center;" dir="ltr">${formatEGP(totals.sumPurchases)}</td>
          <td style="text-align: center; color: #166534;" dir="ltr">${formatEGP(totals.sumPaid)}</td>
          <td style="text-align: center; color: #b91c1c;" dir="ltr">${formatEGP(totals.sumRemaining)}</td>
        </tr>
      `;
      break;

    case 'partners':
      tableHeadersHtml = `
        <tr>
          <th style="width: 35px; text-align: center;">م</th>
          <th>اسم الشريك</th>
          <th style="width: 70px; text-align: center;">النسبة</th>
          <th style="width: 110px; text-align: center;">رأس المال</th>
          <th style="width: 110px; text-align: center;">إجمالي المسحوبات</th>
          <th style="width: 100px; text-align: center;">المرتجع للخزينة</th>
          <th style="width: 110px; text-align: center;">صافي المسحوبات</th>
          <th style="width: 60px; text-align: center;">الحركات</th>
          <th style="width: 120px; text-align: center;">الرصيد الفعلي</th>
          <th style="width: 65px; text-align: center;">الحالة</th>
        </tr>
      `;
      tableBodyHtml = rows.map(r => `
        <tr>
          <td style="text-align: center; color: #64748b;">${r.idx}</td>
          <td style="font-weight: 800; color: #1a2b4c;">${r.name}</td>
          <td style="text-align: center; font-weight: 700; color: #2563eb;">${r.percentage}</td>
          <td style="text-align: center; font-weight: 800;" dir="ltr">${formatEGP(r.capital)}</td>
          <td style="text-align: center; font-weight: 800; color: #b91c1c;" dir="ltr">${formatEGP(r.withdrawn)}</td>
          <td style="text-align: center; font-weight: 700; color: #0d9488;" dir="ltr">${formatEGP(r.returned)}</td>
          <td style="text-align: center; font-weight: 900; color: #b45309;" dir="ltr">${formatEGP(r.net)}</td>
          <td style="text-align: center;">${r.transactions}</td>
          <td style="text-align: center; font-weight: 900; color: ${r.balance >= 0 ? '#1e3a8a' : '#b91c1c'};" dir="ltr">${formatEGP(r.balance)}</td>
          <td style="text-align: center; font-size: 10px; font-weight: 700;">${r.status}</td>
        </tr>
      `).join('');
      tableFootHtml = `
        <tr style="background: #e2e8f0; font-weight: 900; color: #0f172a;">
          <td colspan="3" style="text-align: right; padding: 10px;">إجمالي الشركاء (${totals.count} شريك)</td>
          <td style="text-align: center;" dir="ltr">${formatEGP(totals.sumCapital)}</td>
          <td style="text-align: center; color: #b91c1c;" dir="ltr">${formatEGP(totals.sumWithdrawn)}</td>
          <td style="text-align: center; color: #0d9488;" dir="ltr">${formatEGP(totals.sumReturned)}</td>
          <td style="text-align: center; color: #b45309;" dir="ltr">${formatEGP(totals.sumNet)}</td>
          <td></td>
          <td style="text-align: center; color: #1e3a8a;" dir="ltr">${formatEGP(totals.sumBalance)}</td>
          <td></td>
        </tr>
      `;
      break;

    default:
      break;
  }

  // Write Complete Print Document
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>تقرير ${reportName} - ${companyName}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        body {
          font-family: 'Cairo', sans-serif;
          direction: rtl;
          margin: 0;
          padding: 12px;
          color: #1e293b;
          background: #fff;
          font-size: 11px;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @page {
          size: A4 ${isLandscape ? 'landscape' : 'portrait'};
          margin: 8mm;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
        }
        th, td {
          border: 1px solid #cbd5e1;
          padding: 6px 8px;
          vertical-align: middle;
        }
        th {
          background-color: #1a2b4c !important;
          color: #ffffff !important;
          font-weight: 800;
          font-size: 11px;
          text-align: right;
        }
        tbody tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .page-break { page-break-after: always; }
        .no-break { page-break-inside: avoid; }
      </style>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body>
      <div style="border: 2px solid #1a2b4c; border-radius: 12px; overflow: hidden; padding: 14px; background: #fff;">
        
        <!-- TOP ACCENT LINE -->
        <div style="height: 4px; background: #1a2b4c; margin: -14px -14px 14px -14px;"></div>

        <!-- 1. OFFICIAL BRANDING HEADER -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 12px; margin-bottom: 14px;">
          
          <!-- Contact Box -->
          <div style="background: #f8fafc; border-right: 4px solid #1a2b4c; border-radius: 8px 0 0 8px; padding: 8px 12px; width: 220px; font-size: 10px; color: #1a2b4c;">
            <div style="font-weight: 900; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">بيانات التواصل</div>
            ${phone1 ? `<div><span style="color: #64748b;">${phone1Label}:</span> <strong dir="ltr">${phone1}</strong></div>` : ''}
            ${phone2 ? `<div><span style="color: #64748b;">${phone2Label}:</span> <strong dir="ltr">${phone2}</strong></div>` : ''}
            ${address ? `<div><span style="color: #64748b;">العنوان:</span> <strong>${address}</strong></div>` : ''}
          </div>

          <!-- Center Title -->
          <div style="text-align: center;">
            <h1 style="font-size: 22px; font-weight: 900; color: #1a2b4c; margin: 0 0 4px 0;">${companyName}</h1>
            <p style="font-size: 11px; color: #64748b; font-weight: 700; margin: 0 0 8px 0;">${tagline}</p>
            <div style="display: inline-block; background: #1a2b4c; color: #fff; padding: 4px 18px; border-radius: 9999px; font-size: 13px; font-weight: 900; letter-spacing: 0.5px;">
              تقرير ${reportName} الشامل
            </div>
            <div style="font-size: 10px; font-weight: 700; color: #475569; margin-top: 5px;">
              فترة التقرير: <strong>${periodText}</strong>
            </div>
          </div>

          <!-- Logo & Meta -->
          <div style="width: 220px; display: flex; flex-direction: column; align-items: flex-end; justify-content: center;">
            ${showLogo ? `
              <div style="width: 70px; height: 70px; border-radius: 50%; border: 3px solid #1a2b4c; overflow: hidden; padding: 2px; margin-bottom: 4px; background: #fff;">
                <img src="${logo}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" onerror="this.style.display='none'" />
              </div>
            ` : ''}
            <div style="font-size: 9px; color: #64748b; font-weight: 700;">
              تاريخ الطباعة: <strong dir="ltr">${new Date().toLocaleDateString('ar-EG')}</strong>
            </div>
          </div>

        </div>

        <!-- 2. SUMMARY HIGHLIGHTS -->
        ${summaryHtml}

        <!-- 3. DATA TABLE -->
        <div style="margin-bottom: 14px;">
          <table>
            <thead>
              ${tableHeadersHtml}
            </thead>
            <tbody>
              ${tableBodyHtml}
            </tbody>
            <tfoot>
              ${tableFootHtml}
            </tfoot>
          </table>
        </div>

        <!-- 4. OFFICIAL SIGNATURES & AUDIT BLOCK -->
        <div class="no-break" style="margin-top: 15px; border-top: 2px solid #cbd5e1; padding-top: 10px;">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center;">
            
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; height: 80px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <span style="display: block; font-weight: 800; color: #1a2b4c; font-size: 11px;">إعداد / مُدخل البيانات</span>
                <span style="font-size: 9px; color: #64748b;">مسؤول النظام</span>
              </div>
              <div style="border-bottom: 1px dashed #94a3b8; width: 70%; margin: 0 auto;"></div>
            </div>

            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; height: 80px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <span style="display: block; font-weight: 800; color: #1a2b4c; font-size: 11px;">مراجعة الحسابات والتطابق</span>
                <span style="font-size: 9px; color: #64748b;">المحاسب المسؤول</span>
              </div>
              <div style="border-bottom: 1px dashed #94a3b8; width: 70%; margin: 0 auto;"></div>
            </div>

            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; height: 80px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <span style="display: block; font-weight: 800; color: #1a2b4c; font-size: 11px;">اعتماد الإدارة / الختم</span>
                <span style="font-size: 9px; color: #64748b;">المدير العام</span>
              </div>
              <div style="border-bottom: 1px dashed #94a3b8; width: 70%; margin: 0 auto;"></div>
            </div>

          </div>
        </div>

        <!-- 5. FOOTER DISCLAIMER -->
        <div style="text-align: center; font-size: 9px; color: #94a3b8; margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
          تم استخراج هذا التقرير رسمياً بواسطة السيستم المحاسبي بتاريخ ${new Date().toLocaleString('ar-EG')} - مجموعة الحاج رفعت
        </div>

      </div>
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 600);
}
