import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { 
  FaFileInvoiceDollar, FaShoppingCart, FaChartLine, 
  FaMoneyBillWave, FaBoxes, FaBoxOpen, FaUsers, FaTruck,
  FaFilePdf, FaFileExcel, FaHandshake
} from 'react-icons/fa';

import SalesTable from '../components/reports/SalesTable';
import PurchasesTable from '../components/reports/PurchasesTable';
import ProfitLossView from '../components/reports/ProfitLossView';
import ExpensesTable from '../components/reports/ExpensesTable';
import InventoryMovementsTable from '../components/reports/InventoryMovementsTable';
import ProductsTable from '../components/reports/ProductsTable';
import CustomersTable from '../components/reports/CustomersTable';
import SuppliersTable from '../components/reports/SuppliersTable';
import PartnersTable from '../components/reports/PartnersTable';
import ReportSummary from '../components/reports/ReportSummary';
import ErrorBoundary from '../components/ErrorBoundary';
import { useSettings } from '../context/SettingsContext';
import { exportReportToExcel, exportReportToPDF } from '../utils/reportExportHelper';

const API_BASE = '/api/reports-v2';

const reportTypes = [
  { id: 'sales', name: 'المبيعات', icon: FaFileInvoiceDollar, desc: 'تقرير شامل للمبيعات يوضح إجمالي الفواتير، المبالغ المدفوعة والمتبقية، والأرباح.' },
  { id: 'purchases', name: 'المشتريات', icon: FaShoppingCart, desc: 'تقرير المشتريات يوضح فواتير الشراء والتكلفة الإجمالية.' },
  { id: 'profit-loss', name: 'الأرباح والخسائر', icon: FaChartLine, desc: 'تقرير الأرباح والخسائر: يوضح إجمالي المبيعات وتكلفة البضاعة المباعة والمصروفات وصافي الربح.' },
  { id: 'expenses', name: 'المصروفات', icon: FaMoneyBillWave, desc: 'سجل لجميع المصروفات وتصنيفاتها.' },
  { id: 'inventory-movements', name: 'حركة المخزون', icon: FaBoxes, desc: 'سجل حركات المخزون من وارد ومنصرف.' },
  { id: 'all-products', name: 'جرد المنتجات', icon: FaBoxOpen, desc: 'تقرير بجميع المنتجات وتكلفتها والمباع منها والمتبقي.' },
  { id: 'customers', name: 'العملاء', icon: FaUsers, desc: 'كشف حساب مجمل للعملاء ومسحوباتهم.' },
  { id: 'suppliers', name: 'الموردين', icon: FaTruck, desc: 'كشف حساب مجمل للموردين ومستحقاتهم.' },
  { id: 'partners', name: 'الشراكة والمسحوبات', icon: FaHandshake, desc: 'تقرير شامل لحصص الشركاء، مساهمات رأس المال، المسحوبات خلال الفترة، المبالغ المرتجعة، وصافي المسحوبات الحقيقية.' },
];

const Reports = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeReport, setActiveReport] = useState(() => searchParams.get('tab') || 'sales');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && reportTypes.some(r => r.id === tab)) {
      setActiveReport(tab);
    }
  }, [searchParams]);
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { settings } = useSettings();

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await axios.get(`${API_BASE}/${activeReport}?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line
  }, [activeReport, startDate, endDate]);

  const setDateRange = (type) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (type === 'today') {
      // today
    } else if (type === 'week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); 
      start.setDate(diff);
    } else if (type === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (type === 'year') {
      start = new Date(today.getFullYear(), 0, 1);
    }
    
    // format YYYY-MM-DD
    const format = (d) => {
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
    };

    setStartDate(format(start));
    setEndDate(format(end));
  };

  const activeInfo = reportTypes.find(r => r.id === activeReport);

  const exportExcel = () => {
    if (!data) return alert("لا توجد بيانات لتصديرها");
    exportReportToExcel({
      reportType: activeReport,
      reportName: activeInfo?.name || 'التقرير',
      dateRange: { startDate, endDate },
      data,
      settings
    });
  };

  const exportPDF = () => {
    if (!data) return alert("لا توجد بيانات لتصديرها");
    exportReportToPDF({
      reportType: activeReport,
      reportName: activeInfo?.name || 'التقرير',
      dateRange: { startDate, endDate },
      data,
      settings
    });
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FaChartLine className="text-blue-600" /> التقارير الشاملة
          </h1>
          <div className="flex gap-2 mt-4 md:mt-0">
            <button onClick={exportExcel} className="btn bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center gap-2 font-medium shadow-sm transition-all cursor-pointer">
              <FaFileExcel /> تصدير Excel
            </button>
            <button onClick={exportPDF} className="btn bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md flex items-center gap-2 font-medium shadow-sm transition-all cursor-pointer">
              <FaFilePdf /> تصدير PDF
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          
          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">نوع التقرير</label>
            <select 
              value={activeReport}
              onChange={(e) => {
                setActiveReport(e.target.value);
                setSearchParams({ tab: e.target.value });
              }}
              className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
            >
              {reportTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">من تاريخ</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50" />
          </div>
          
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">إلى تاريخ</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50" />
          </div>

          <div className="md:col-span-2 flex flex-col gap-1">
            <div className="text-xs text-gray-500 text-center">فترات سريعة</div>
            <div className="flex flex-wrap gap-1 justify-center">
              <button onClick={() => setDateRange('today')} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-xs rounded border border-gray-300">اليوم</button>
              <button onClick={() => setDateRange('week')} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-xs rounded border border-gray-300">هذا الأسبوع</button>
              <button onClick={() => setDateRange('month')} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-xs rounded border border-gray-300">هذا الشهر</button>
              <button onClick={() => setDateRange('year')} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-xs rounded border border-gray-300">هذه السنة</button>
            </div>
          </div>
        </div>

        {/* Info Card */}
        {activeInfo && (
          <div className="bg-blue-50 border-r-4 border-blue-500 p-4 rounded-lg flex items-start gap-3">
            <activeInfo.icon className="text-blue-500 text-xl mt-1" />
            <div>
              <h3 className="font-bold text-blue-800">{activeInfo.name}</h3>
              <p className="text-blue-600 text-sm">{activeInfo.desc}</p>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        ) : data ? (
          <ErrorBoundary>
            <div id="report-printable-area" className="space-y-6">
              {activeReport !== 'profit-loss' && data.summary && <ReportSummary summary={data.summary} type={activeReport} />}
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                {activeReport === 'sales' && <SalesTable data={Array.isArray(data.sales) ? data.sales : (Array.isArray(data) ? data : [])} />}
                {activeReport === 'purchases' && <PurchasesTable data={Array.isArray(data.purchases) ? data.purchases : (Array.isArray(data) ? data : [])} />}
                {activeReport === 'profit-loss' && <ProfitLossView data={data} />}
                {activeReport === 'expenses' && <ExpensesTable data={Array.isArray(data.expenses) ? data.expenses : (Array.isArray(data) ? data : [])} />}
                {activeReport === 'inventory-movements' && <InventoryMovementsTable data={Array.isArray(data) ? data : (Array.isArray(data?.movements) ? data.movements : [])} />}
                {activeReport === 'all-products' && <ProductsTable data={Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : [])} />}
                {activeReport === 'customers' && <CustomersTable data={Array.isArray(data) ? data : (Array.isArray(data?.customers) ? data.customers : [])} />}
                {activeReport === 'suppliers' && <SuppliersTable data={Array.isArray(data) ? data : (Array.isArray(data?.suppliers) ? data.suppliers : [])} />}
                {activeReport === 'partners' && <PartnersTable data={data} />}
              </div>
            </div>
          </ErrorBoundary>
        ) : (
          <div className="text-center text-gray-500 py-12">لا توجد بيانات للعرض</div>
        )}

      </div>
    </div>
  );
};

export default Reports;
