import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Users, Factory, Home, Settings, FileText, ShoppingCart, Menu, X, Receipt, Package, Truck, Wallet, Activity, Calendar, PlusCircle, AlertCircle, Cpu, Percent } from 'lucide-react';
import StressTestPage from './pages/StressTestPage';
import ErrorBoundary from './components/ErrorBoundary';

import SuppliersList from './pages/SuppliersList';
import SupplierDetails from './pages/SupplierDetails';
import CustomersList from './pages/CustomersList';
import CustomerDetails from './pages/CustomerDetails';
import Expenses from './pages/Expenses';
import WorkersList from './pages/WorkersList';
import WorkerDetails from './pages/WorkerDetails';
import OtherExpenses from './pages/OtherExpenses';
import Reports from './pages/Reports';
import Warehouse from './pages/Warehouse';
import ProductDetails from './pages/ProductDetails';
import Dashboard from './pages/Dashboard';
import SalesList from './pages/SalesList';
import VehiclesList from './pages/VehiclesList';
import VehicleDetails from './pages/VehicleDetails';
import BarsalList from './pages/BarsalList';
import Treasury from './pages/Treasury';
import ActivityLog from './pages/ActivityLog';
import ServicesList from './pages/ServicesList';
import SettingsPage from './pages/Settings';
import PartnershipDashboard from './pages/PartnershipDashboard';
import PartnerDetails from './pages/PartnerDetails';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { PeriodProvider, usePeriod } from './context/PeriodContext';
import AccountingPeriodBar from './components/AccountingPeriodBar';

function Sidebar({ isOpen, setIsOpen }) {
  const location = useLocation();
  const { settings } = useSettings();
  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/suppliers/');
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const navItems = [
    { name: 'الرئيسية', path: '/home', icon: <Home size={18} /> },
    { name: 'الموردين والمصانع', path: '/', icon: <Factory size={18} /> },
    { name: 'العملاء', path: '/customers', icon: <Users size={18} /> },
    { name: 'المبيعات', path: '/sales', icon: <ShoppingCart size={18} /> },
    { name: 'الخزينة (سندات)', path: '/treasury', icon: <Wallet size={18} /> },
    { name: 'الشراكة', path: '/partners', icon: <Percent size={18} /> },
    { name: 'سجل النشاطات', path: '/activity', icon: <Activity size={18} /> },
    { name: 'تصفية عربيات', path: '/transport', icon: <Truck size={18} /> },
    { name: 'حساب البرسل', path: '/barsal', icon: <FileText size={18} /> },
    { name: 'الخدمات', path: '/services', icon: <Settings size={18} /> },
    { name: 'المخزن', path: '/warehouse', icon: <Package size={18} /> },
    { name: 'العمال', path: '/expenses/workers', icon: <Users size={18} /> },
    { name: 'مصروفات أخرى', path: '/expenses/other', icon: <Receipt size={18} /> },
    { name: 'التقارير', path: '/reports', icon: <FileText size={18} /> },
    { name: 'الإعدادات', path: '/settings', icon: <Settings size={18} /> },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      <div
        className={`
          w-64 bg-slate-800 text-white h-screen max-h-screen flex flex-col
          fixed right-0 top-0 z-50 overflow-hidden shadow-2xl
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-2.5 sm:p-3 border-b border-slate-700 flex flex-col items-center relative flex-shrink-0">
          <button
            className="absolute top-2.5 left-2.5 lg:hidden text-gray-400 hover:text-white p-1 rounded"
            onClick={() => setIsOpen(false)}
            aria-label="إغلاق القائمة"
          >
            <X size={20} />
          </button>

          <div className="bg-white p-1.5 rounded-full mb-1 w-14 h-14 sm:w-16 sm:h-16 overflow-hidden shadow-lg border-2 border-slate-600 flex-shrink-0">
            <img
              src={settings.company_logo || '/logo.jpg'}
              alt="Logo"
              className="w-full h-full object-contain"
              onError={(e) => { e.target.src = '/logo.jpg'; }}
            />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-center text-blue-400 truncate max-w-[200px]">
            {settings.company_name || 'نظام الإدارة'}
          </h2>
        </div>

        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto min-h-0 select-none">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-xs sm:text-sm ${
                isActive(item.path)
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white font-medium'
              }`}
            >
              {item.icon}
              <span className="truncate">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="p-2 border-t border-slate-700 text-[11px] text-center text-emerald-400 font-bold flex-shrink-0">
          الإصدار الشامل المحدث 2.4 (أحدث تعديلات)
        </div>
      </div>
    </>
  );
}

function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { settings } = useSettings();
  const { isSelectedPeriodClosed, selectedPeriod } = usePeriod();

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex" dir="rtl">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="flex-1 lg:mr-64 flex flex-col min-h-screen min-w-0">
        <header className="bg-white shadow-sm sticky top-0 z-30">
          <div className="px-4 py-3 flex items-center gap-3 justify-between flex-wrap">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden text-gray-600 hover:text-gray-900 focus:outline-none p-1 rounded"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="فتح القائمة"
              >
                <Menu size={26} />
              </button>
              <h1 className="text-base sm:text-xl font-bold text-gray-700 truncate">
                نظام إدارة {settings.company_name || 'الشركة'}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/settings"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded-lg text-xs sm:text-sm font-semibold transition-colors border border-slate-300 shadow-sm"
                title="الإعدادات"
              >
                <Settings size={18} className="text-slate-600" />
                <span>الإعدادات</span>
              </Link>
              <AccountingPeriodBar />
            </div>
          </div>

          {isSelectedPeriodClosed && (
            <div className="bg-amber-500 text-white text-xs sm:text-sm font-bold p-2 text-center flex items-center justify-center gap-2 shadow-inner">
              <AlertCircle size={18} />
              <span>
                أنت تتصفح بيانات فترة محاسبية مغلقة ({selectedPeriod?.name}). هذا العرض مخصص للمراجعة والطباعة فقط.
              </span>
            </div>
          )}
        </header>

        <main className="flex-1 p-3 sm:p-5 lg:p-8 overflow-x-hidden">
          <ErrorBoundary>
            <Routes>
              <Route path="/home" element={<Dashboard />} />
              <Route path="/" element={<SuppliersList />} />
              <Route path="/suppliers/:id" element={<SupplierDetails />} />
              <Route path="/customers" element={<CustomersList />} />
              <Route path="/customers/:id" element={<CustomerDetails />} />
              <Route path="/sales" element={<SalesList />} />
              <Route path="/treasury" element={<Treasury />} />
              <Route path="/partners" element={<PartnershipDashboard />} />
              <Route path="/partners/:id" element={<PartnerDetails />} />
              <Route path="/activity" element={<ActivityLog />} />
              <Route path="/transport" element={<VehiclesList />} />
              <Route path="/transport/:id" element={<VehicleDetails />} />
              <Route path="/barsal" element={<BarsalList />} />
              <Route path="/services" element={<ServicesList />} />
              <Route path="/warehouse" element={<Warehouse />} />
              <Route path="/warehouse/:id" element={<ProductDetails />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/expenses/workers" element={<WorkersList />} />
              <Route path="/expenses/workers/:id" element={<WorkerDetails />} />
              <Route path="/expenses/other" element={<OtherExpenses />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/stress-test" element={<StressTestPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <SettingsProvider>
      <PeriodProvider>
        <BrowserRouter>
          <MainLayout />
        </BrowserRouter>
      </PeriodProvider>
    </SettingsProvider>
  );
}

export default App;
