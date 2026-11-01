import React, { useState } from 'react';
import axios from 'axios';
import { 
  FaBalanceScale, FaMoneyBillWave, FaUsers, FaTruck, 
  FaBoxes, FaChartLine, FaInfoCircle, FaCheckCircle, 
  FaExclamationTriangle, FaSearchPlus, FaTimes, 
  FaUniversity, FaHandHoldingUsd, FaWarehouse
} from 'react-icons/fa';

// تنسيق المبالغ بشكل نظيف بدون كسور وأصفار ملهاش لزمة
const formatCurrency = (val) => {
  const num = Number(val) || 0;
  return Math.round(num).toLocaleString('ar-EG') + ' ج.م';
};

const FinancialPositionView = ({ data, startDate, endDate, asOfDate }) => {
  const [modalType, setModalType] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  if (!data || !data.assets) {
    return <div className="p-8 text-center text-gray-500 font-bold">مفيش بيانات متاحة لعرض المركز المالي</div>;
  }

  const {
    assets = {},
    liabilities = {},
    netPosition = {},
    customerSummary = {},
    supplierSummary = {},
    inventorySummary = {},
    cashSummary = {},
    expensesSummary = {},
    profitLossSummary = {},
    equitySummary = {}
  } = data;

  const openDrillDown = async (type) => {
    setModalType(type);
    setModalLoading(true);
    setModalSearch('');
    try {
      const params = new URLSearchParams();
      if (asOfDate) params.append('asOfDate', asOfDate);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await axios.get(`/api/reports-v2/financial-position/${type}?${params.toString()}`);
      setModalData(res.data);
    } catch (err) {
      console.error('Error fetching drill-down:', err);
      alert('حصل خطأ أثناء تحميل التفاصيل');
      setModalType(null);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setModalType(null);
    setModalData(null);
    setModalSearch('');
  };

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      
      {/* 1. البانر الرئيسي: حسبة رأس المال الصافي */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-400/30">
              <FaBalanceScale className="text-3xl text-blue-300" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-white">
                حسبة المركز المالي ورأس المال الحقيقي
              </h2>
              <p className="text-blue-200 text-sm mt-1">
                حسبة بسيطة وواضحة: بتعرفك كل اللي ليك، وكل اللي عليك، وقيمة بضاعتك، وصافي فلوسك كام بالظبط
              </p>
            </div>
          </div>
          
          <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/15 text-right">
            <span className="text-xs text-blue-200 block">الحساب حتى تاريخ:</span>
            <span className="text-base font-bold text-white tracking-wide">{asOfDate || data.asOfDate || 'اليوم'}</span>
            {data.period && data.period.startDate && (
              <span className="text-xs text-blue-300 block mt-0.5">
                فترة الأرباح: من {data.period.startDate} إلى {data.period.endDate}
              </span>
            )}
          </div>
        </div>

        {/* الكروت الكبيرة للنتيجة الصافية */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-xl p-4">
            <span className="text-xs font-bold text-emerald-200 block">كل اللي تملكه الشركة (فلوس وبضاعة)</span>
            <div className="text-2xl md:text-3xl font-black text-white mt-1">
              {formatCurrency(assets.totalAssets)}
            </div>
            <span className="text-xs text-emerald-300/80 mt-1 block">كاش بالخزن + فلوس عند الزباين + بضاعة بالمخزن + رصيد مصانع</span>
          </div>

          <div className="bg-rose-500/20 border border-rose-400/40 rounded-xl p-4">
            <span className="text-xs font-bold text-rose-200 block">كل الديون اللي علينا للموردين</span>
            <div className="text-2xl md:text-3xl font-black text-white mt-1">
              {formatCurrency(liabilities.totalLiabilities)}
            </div>
            <span className="text-xs text-rose-300/80 mt-1 block">مستحقات تجار وموردي البضاعة والحديد</span>
          </div>

          <div className="bg-amber-500/25 border-2 border-amber-400/70 rounded-xl p-4">
            <span className="text-xs font-bold text-amber-200 block">صافي رأس مالك وفلوسك الحقيقية</span>
            <div className="text-2xl md:text-3xl font-black text-amber-300 mt-1">
              {formatCurrency(netPosition.netAssets)}
            </div>
            <span className="text-xs text-amber-200/90 mt-1 block">كل اللي تملكه مطروحاً منه الديون اللي عليك</span>
          </div>
        </div>
      </div>

      {/* 2. كروت سريعة ونظيفة بدون زحمة */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* كاش */}
        <div 
          onClick={() => openDrillDown('cash')}
          className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 hover:border-blue-400 transition cursor-pointer hover:shadow-md"
        >
          <div className="flex items-center justify-between text-blue-600 mb-1.5">
            <span className="text-xs font-bold text-gray-500">فلوس كاش وفي البنوك</span>
            <FaMoneyBillWave className="text-base" />
          </div>
          <div className="text-lg font-black text-gray-900">{formatCurrency(assets.liquidCash)}</div>
          <div className="text-[11px] text-blue-600 mt-1 flex items-center gap-1 font-bold">
            <FaSearchPlus /> تفاصيل الخزن
          </div>
        </div>

        {/* زباين */}
        <div 
          onClick={() => openDrillDown('customers')}
          className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 hover:border-emerald-400 transition cursor-pointer hover:shadow-md"
        >
          <div className="flex items-center justify-between text-emerald-600 mb-1.5">
            <span className="text-xs font-bold text-gray-500">فلوسنا برة عند الزباين</span>
            <FaUsers className="text-base" />
          </div>
          <div className="text-lg font-black text-gray-900">{formatCurrency(assets.customerReceivables)}</div>
          <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-bold">
            <FaSearchPlus /> {customerSummary.indebtedCustomersCount} عميل عليه حساب
          </div>
        </div>

        {/* مخزن */}
        <div 
          onClick={() => openDrillDown('inventory')}
          className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 hover:border-amber-400 transition cursor-pointer hover:shadow-md"
        >
          <div className="flex items-center justify-between text-amber-600 mb-1.5">
            <span className="text-xs font-bold text-gray-500">بضاعة في المخزن بسعر الشراء</span>
            <FaWarehouse className="text-base" />
          </div>
          <div className="text-lg font-black text-gray-900">{formatCurrency(assets.inventoryAtCost)}</div>
          <div className="text-[11px] text-amber-600 mt-1 flex items-center gap-1 font-bold">
            <FaSearchPlus /> جرد المخزن
          </div>
        </div>

        {/* موردين */}
        <div 
          onClick={() => openDrillDown('suppliers')}
          className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 hover:border-rose-400 transition cursor-pointer hover:shadow-md"
        >
          <div className="flex items-center justify-between text-rose-600 mb-1.5">
            <span className="text-xs font-bold text-gray-500">ديون علينا للموردين</span>
            <FaTruck className="text-base" />
          </div>
          <div className="text-lg font-black text-gray-900">{formatCurrency(liabilities.supplierPayables)}</div>
          <div className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-bold">
            <FaSearchPlus /> {supplierSummary.indebtedSuppliersCount} مورد ليه فلوس
          </div>
        </div>

        {/* مصاريف */}
        <div 
          onClick={() => openDrillDown('expenses')}
          className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 hover:border-purple-400 transition cursor-pointer hover:shadow-md"
        >
          <div className="flex items-center justify-between text-purple-600 mb-1.5">
            <span className="text-xs font-bold text-gray-500">مصاريف الشغل والعمال</span>
            <FaHandHoldingUsd className="text-base" />
          </div>
          <div className="text-lg font-black text-gray-900">{formatCurrency(expensesSummary.totalExpenses)}</div>
          <div className="text-[11px] text-purple-600 mt-1 flex items-center gap-1 font-bold">
            <FaSearchPlus /> تفاصيل المصاريف
          </div>
        </div>

        {/* صافي الربح */}
        <div 
          onClick={() => openDrillDown('profit')}
          className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 hover:border-green-400 transition cursor-pointer hover:shadow-md"
        >
          <div className="flex items-center justify-between text-green-600 mb-1.5">
            <span className="text-xs font-bold text-gray-500">مكسبي الصافي في الفترة</span>
            <FaChartLine className="text-base" />
          </div>
          <div className={`text-lg font-black ${profitLossSummary.netProfit >= 0 ? 'text-green-700' : 'text-rose-700'}`}>
            {formatCurrency(profitLossSummary.netProfit)}
          </div>
          <div className="text-[11px] text-green-600 mt-1 flex items-center gap-1 font-bold">
            <FaSearchPlus /> نسبة المكسب: {profitLossSummary.profitMargin}%
          </div>
        </div>

      </div>

      {/* تنبيه مخزون سالب إن وجد */}
      {inventorySummary.negativeStockCount > 0 && (
        <div className="bg-amber-50 border-r-4 border-amber-500 p-3.5 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <FaExclamationTriangle className="text-amber-600 text-xl shrink-0" />
            <div>
              <h4 className="font-bold text-amber-900 text-sm">تنبيه: فيه أصناف في المخزن برصيد سالب</h4>
              <p className="text-amber-700 text-xs">
                فيه ({inventorySummary.negativeStockCount}) صنف مسجل برصيد سالب. راجع فواتير الشراء أو التسويات عشان الجرد يظبط.
              </p>
            </div>
          </div>
          <button 
            onClick={() => openDrillDown('inventory')}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            شوف الأصناف
          </button>
        </div>
      )}

      {/* 3. تفاصيل اللي لينا واللي علينا (مقارنة واضحة جداً) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* جدول اللي لينا */}
        <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
          <div className="bg-emerald-50 border-b border-emerald-100 p-3.5 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <h3 className="font-bold text-gray-900 text-base">كل ممتلكات وفلوس الشركة (اللي لينا)</h3>
            </div>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
              حتى اليوم
            </span>
          </div>

          <div className="divide-y divide-gray-100 text-sm">
            {/* كاش */}
            <div className="p-3.5 hover:bg-gray-50 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-800">فلوس كاش في الخزنة والبنوك والمحافظ</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  الخزنة: {formatCurrency(assets.treasuryCash)} | البنك: {formatCurrency(assets.bankCash)} | المحافظ: {formatCurrency(assets.walletCash)}
                </p>
              </div>
              <div className="text-left">
                <span className="font-bold text-gray-900 block">{formatCurrency(assets.liquidCash)}</span>
                <button onClick={() => openDrillDown('cash')} className="text-xs text-blue-600 hover:underline cursor-pointer">
                  التفاصيل
                </button>
              </div>
            </div>

            {/* زباين */}
            <div className="p-3.5 hover:bg-gray-50 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-800">فلوس لينا برة عند الزباين (آجل)</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  قديم: {formatCurrency(customerSummary.openingBalance)} + فواتير بيع: {formatCurrency(customerSummary.totalSales)} - اللي دفعوه: {formatCurrency(customerSummary.totalPaid)}
                </p>
              </div>
              <div className="text-left">
                <span className="font-bold text-gray-900 block">{formatCurrency(assets.customerReceivables)}</span>
                <button onClick={() => openDrillDown('customers')} className="text-xs text-emerald-600 hover:underline cursor-pointer">
                  التفاصيل
                </button>
              </div>
            </div>

            {/* بضاعة مخزن */}
            <div className="p-3.5 hover:bg-gray-50 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-800">قيمة البضاعة في المخزن (بسعر التكلفة والشراء)</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  محسوبة بسعر الشراء الفعلي مش بسعر البيع
                </p>
              </div>
              <div className="text-left">
                <span className="font-bold text-gray-900 block">{formatCurrency(assets.inventoryAtCost)}</span>
                <button onClick={() => openDrillDown('inventory')} className="text-xs text-amber-600 hover:underline cursor-pointer">
                  التفاصيل
                </button>
              </div>
            </div>

            {/* مقدمات مصانع */}
            <div className="p-3.5 hover:bg-gray-50 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-800">فلوس لينا دافعينها مقدم للمصانع</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  دفعات وعرابين محطوطة عند المصانع لسحب بضاعة
                </p>
              </div>
              <div className="text-left">
                <span className="font-bold text-gray-900 block">{formatCurrency(assets.factoryAdvances)}</span>
                <button onClick={() => openDrillDown('suppliers')} className="text-xs text-cyan-600 hover:underline cursor-pointer">
                  التفاصيل
                </button>
              </div>
            </div>

            {/* إجمالي اللي لينا */}
            <div className="p-3.5 bg-emerald-50/50 flex items-center justify-between border-t-2 border-emerald-200">
              <span className="font-black text-gray-900">إجمالي كل ممتلكات وفلوس الشركة</span>
              <span className="font-black text-emerald-800 text-lg">{formatCurrency(assets.totalAssets)}</span>
            </div>
          </div>
        </div>

        {/* جدول اللي علينا وصافي رأس المال */}
        <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-rose-50 border-b border-rose-100 p-3.5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <h3 className="font-bold text-gray-900 text-base">الديون اللي علينا وصافي فلوسك</h3>
              </div>
              <span className="text-xs bg-rose-100 text-rose-800 font-bold px-2.5 py-0.5 rounded-full">
                حتى اليوم
              </span>
            </div>

            <div className="divide-y divide-gray-100 text-sm">
              {/* ديون الموردين */}
              <div className="p-3.5 hover:bg-gray-50 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-gray-800">ديون علينا لموردي البضاعة والحديد</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    فواتير مشتريات: {formatCurrency(supplierSummary.totalPurchases)} - اللي سددناه: {formatCurrency(supplierSummary.totalPayments)}
                  </p>
                </div>
                <div className="text-left">
                  <span className="font-bold text-rose-700 block">{formatCurrency(liabilities.supplierPayables)}</span>
                  <button onClick={() => openDrillDown('suppliers')} className="text-xs text-rose-600 hover:underline cursor-pointer">
                    التفاصيل
                  </button>
                </div>
              </div>

              {/* إجمالي الديون */}
              <div className="p-3.5 bg-rose-50/40 flex items-center justify-between border-t border-rose-100">
                <span className="font-bold text-gray-800">إجمالي كل الديون اللي علينا برة</span>
                <span className="font-bold text-rose-800 text-base">{formatCurrency(liabilities.totalLiabilities)}</span>
              </div>

              {/* صافي رأس المال */}
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-t-2 border-amber-300">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-amber-950 text-base block">صافي رأس مالك وفلوسك الحقيقية</span>
                    <span className="text-xs text-amber-800 font-medium">
                      الحسبة ببساطة: كل اللي تملكه ({formatCurrency(assets.totalAssets)}) ناقص كل الديون ({formatCurrency(liabilities.totalLiabilities)})
                    </span>
                  </div>
                  <span className="font-black text-amber-900 text-2xl">{formatCurrency(netPosition.netAssets)}</span>
                </div>
              </div>

              {/* ملاحظة رأس المال والشركاء */}
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <div className="flex items-start gap-2">
                  <FaInfoCircle className="text-blue-500 mt-0.5 shrink-0 text-sm" />
                  <div className="text-xs text-gray-600 leading-relaxed">
                    <strong className="text-gray-800">ملاحظة عن رأس المال: </strong>
                    {equitySummary.hasPartnerRecords ? (
                      <span>رأس مال الشركاء المسجل: <strong>{formatCurrency(equitySummary.registeredCapital)}</strong>، والباقي أرباح محتجزة وفروق تشغيل.</span>
                    ) : (
                      <span className="text-amber-900">
                        مفيش شركاء مسجلين في السيستم، والصافي ده هو رأس مالك الحقيقي التقديري لو صفينا كل حاجة النهاردة.
                      </span>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* 4. كشف الأرباح والمصاريف للفترة */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-gray-200 p-3.5 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div>
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <FaChartLine className="text-blue-600" /> كشف الأرباح ومصاريف الفترة
            </h3>
            <p className="text-xs text-gray-500">
              المكسب الحقيقي المحسوب: إجمالي المبيعات ناقص تكلفة شرائها الأصلية ناقص كل المصاريف
            </p>
          </div>
          <button 
            onClick={() => openDrillDown('profit')}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <FaSearchPlus /> كشف تفاصيل مكسبي في الفواتير
          </button>
        </div>

        <div className="p-4 md:p-5">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
            
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
              <span className="text-xs text-blue-600 font-bold block mb-1">إجمالي المبيعات</span>
              <span className="text-base font-black text-gray-900">{formatCurrency(profitLossSummary.totalSales)}</span>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <span className="text-xs text-gray-600 font-bold block mb-1">خصومات وزاره</span>
              <span className="text-base font-black text-gray-900">{formatCurrency(profitLossSummary.salesReturnsZara)}</span>
            </div>

            <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
              <span className="text-xs text-orange-600 font-bold block mb-1">تكلفة البضاعة اللي اتباعت</span>
              <span className="text-base font-black text-gray-900">{formatCurrency(profitLossSummary.cogs)}</span>
            </div>

            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
              <span className="text-xs text-emerald-600 font-bold block mb-1">مكسب البيع (قبل المصاريف)</span>
              <span className="text-base font-black text-emerald-700">{formatCurrency(profitLossSummary.grossProfit)}</span>
            </div>

            <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
              <span className="text-xs text-purple-600 font-bold block mb-1">مصاريف الشغل والعمال</span>
              <span className="text-base font-black text-purple-700">{formatCurrency(profitLossSummary.operatingExpenses)}</span>
            </div>

            <div className={`p-3 rounded-xl border-2 ${profitLossSummary.netProfit >= 0 ? 'bg-green-100 border-green-500' : 'bg-rose-100 border-rose-500'}`}>
              <span className={`text-xs font-bold block mb-1 ${profitLossSummary.netProfit >= 0 ? 'text-green-800' : 'text-rose-800'}`}>
                صافي مكسبي الحقيقي
              </span>
              <span className={`text-lg font-black ${profitLossSummary.netProfit >= 0 ? 'text-green-800' : 'text-rose-800'}`}>
                {formatCurrency(profitLossSummary.netProfit)}
              </span>
              <span className="text-[11px] text-gray-600 block mt-0.5">نسبة المكسب: {profitLossSummary.profitMargin}%</span>
            </div>

          </div>
        </div>
      </div>

      {/* 5. نوافذ التفاصيل المنبثقة (Drill-Down Modals) بكلام عربي بسيط وبدون إنجليزي */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
            
            {/* عنوان النافذة */}
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaSearchPlus className="text-blue-400 text-lg" />
                <h3 className="text-base font-bold">
                  {modalType === 'customers' && 'كشف حسابات وأرصدة الزباين (اللي لينا عندهم)'}
                  {modalType === 'suppliers' && 'كشف حسابات الموردين والمصانع (اللي علينا ليهم)'}
                  {modalType === 'inventory' && 'جرد وتكلفة البضاعة في المخزن'}
                  {modalType === 'cash' && 'كشف أرصدة الخزن والحسابات البنكية والمحافظ'}
                  {modalType === 'expenses' && 'تفاصيل مصاريف الشغل والمحل والعمال'}
                  {modalType === 'profit' && 'تفاصيل مكسب كل فاتورة وصنف اتباع'}
                </h3>
              </div>
              <button 
                onClick={closeModal}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-gray-300 hover:text-white cursor-pointer"
              >
                <FaTimes className="text-base" />
              </button>
            </div>

            {/* شريط البحث */}
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <input 
                type="text"
                placeholder="ابحث هنا بالاسم أو الرقم..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* محتوى النافذة */}
            <div className="p-4 overflow-y-auto flex-1">
              {modalLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="text-xs text-gray-500">جاري تحميل السجلات...</span>
                </div>
              ) : modalData ? (
                <div>
                  
                  {/* كشف الزباين */}
                  {modalType === 'customers' && modalData.customers && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs md:text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-gray-700 border-b border-slate-200">
                            <th className="p-2 font-bold">اسم العميل</th>
                            <th className="p-2 font-bold">رقم التليفون</th>
                            <th className="p-2 font-bold">حساب قديم</th>
                            <th className="p-2 font-bold">عدد الفواتير</th>
                            <th className="p-2 font-bold">إجمالي المبيعات</th>
                            <th className="p-2 font-bold">اللي دفعه</th>
                            <th className="p-2 font-bold">خصومات وزاره</th>
                            <th className="p-2 font-bold text-emerald-800">الباقي عليه</th>
                            <th className="p-2 font-bold text-rose-800">مبالغ متأخرة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {modalData.customers
                            .filter(c => !modalSearch || (c.name && c.name.toLowerCase().includes(modalSearch.toLowerCase())) || (c.phone && c.phone.includes(modalSearch)))
                            .map((c, idx) => (
                              <tr key={c.id || idx} className="hover:bg-blue-50/50">
                                <td className="p-2 font-bold text-gray-800">{c.name}</td>
                                <td className="p-2 text-gray-600" dir="ltr">{c.phone || '-'}</td>
                                <td className="p-2">{formatCurrency(c.opening_balance)}</td>
                                <td className="p-2">{c.sales_count || 0}</td>
                                <td className="p-2 font-semibold">{formatCurrency(c.total_sales)}</td>
                                <td className="p-2 text-emerald-700 font-semibold">{formatCurrency(c.total_paid)}</td>
                                <td className="p-2 text-gray-600">{formatCurrency(c.total_adjustments)}</td>
                                <td className="p-2 font-black text-emerald-800">{formatCurrency(c.remaining_balance)}</td>
                                <td className="p-2 font-bold text-rose-700">{formatCurrency(c.overdue_amount)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* كشف الموردين */}
                  {modalType === 'suppliers' && modalData.suppliers && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs md:text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-gray-700 border-b border-slate-200">
                            <th className="p-2 font-bold">المورد / المصنع</th>
                            <th className="p-2 font-bold">النوع</th>
                            <th className="p-2 font-bold">حساب قديم</th>
                            <th className="p-2 font-bold">عدد الفواتير</th>
                            <th className="p-2 font-bold">إجمالي المشتريات</th>
                            <th className="p-2 font-bold">اللي سددناه</th>
                            <th className="p-2 font-bold">الرصيد الحالي</th>
                            <th className="p-2 font-bold">طبيعة الحساب</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {modalData.suppliers
                            .filter(s => !modalSearch || (s.name && s.name.toLowerCase().includes(modalSearch.toLowerCase())))
                            .map((s, idx) => (
                              <tr key={s.id || idx} className="hover:bg-blue-50/50">
                                <td className="p-2 font-bold text-gray-800">{s.name}</td>
                                <td className="p-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.type === 'مصنع' ? 'bg-cyan-100 text-cyan-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {s.type || 'مورد'}
                                  </span>
                                </td>
                                <td className="p-2">{formatCurrency(s.opening_balance)}</td>
                                <td className="p-2">{s.purchases_count || 0}</td>
                                <td className="p-2 font-semibold">{formatCurrency(s.total_purchases)}</td>
                                <td className="p-2 text-emerald-700 font-semibold">{formatCurrency(s.invoice_paid || s.deposits_net)}</td>
                                <td className="p-2 font-black text-gray-900">{formatCurrency(s.current_balance)}</td>
                                <td className="p-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.classification === 'factory_advance' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                    {s.classification === 'factory_advance' ? 'رصيد لينا مقدم' : 'دين علينا للمورد'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* جرد المخزن */}
                  {modalType === 'inventory' && modalData.inventory && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs md:text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-gray-700 border-b border-slate-200">
                            <th className="p-2 font-bold">اسم الصنف</th>
                            <th className="p-2 font-bold">الوحدة</th>
                            <th className="p-2 font-bold">وارد للمخزن</th>
                            <th className="p-2 font-bold">منصرف ومباع</th>
                            <th className="p-2 font-bold">الباقي في المخزن</th>
                            <th className="p-2 font-bold">متوسط سعر التكلفة</th>
                            <th className="p-2 font-bold text-amber-800">قيمة البضاعة بسعر الشراء</th>
                            <th className="p-2 font-bold">حالة المخزون</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {modalData.inventory
                            .filter(i => !modalSearch || (i.name && i.name.toLowerCase().includes(modalSearch.toLowerCase())))
                            .map((i, idx) => (
                              <tr key={i.id || idx} className="hover:bg-blue-50/50">
                                <td className="p-2 font-bold text-gray-800">{i.name}</td>
                                <td className="p-2 text-gray-600">{i.unit || '-'}</td>
                                <td className="p-2 text-blue-700 font-semibold">{i.in_quantity}</td>
                                <td className="p-2 text-orange-700 font-semibold">{i.out_quantity}</td>
                                <td className={`p-2 font-black ${i.current_stock < 0 ? 'text-rose-700' : 'text-gray-900'}`}>
                                  {i.current_stock}
                                </td>
                                <td className="p-2">{formatCurrency(i.unit_cost)}</td>
                                <td className="p-2 font-black text-amber-900">{formatCurrency(i.total_value)}</td>
                                <td className="p-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    i.status === 'available' ? 'bg-emerald-100 text-emerald-800' :
                                    (i.status === 'zero' ? 'bg-gray-100 text-gray-700' : 'bg-rose-100 text-rose-800')
                                  }`}>
                                    {i.status === 'available' ? 'متوفر' : (i.status === 'zero' ? 'خلصان' : 'رصيد سالب')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* كشف الخزن والبنوك */}
                  {modalType === 'cash' && modalData.accounts && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs md:text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-gray-700 border-b border-slate-200">
                            <th className="p-2 font-bold">اسم الخزنة / الحساب</th>
                            <th className="p-2 font-bold">النوع</th>
                            <th className="p-2 font-bold text-emerald-700">إجمالي الفلوس اللي دخلت</th>
                            <th className="p-2 font-bold text-rose-700">إجمالي الفلوس اللي خرجت</th>
                            <th className="p-2 font-bold text-blue-800">الرصيد الموجود حالياً</th>
                            <th className="p-2 font-bold">عدد العمليات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {modalData.accounts
                            .filter(a => !modalSearch || (a.name && a.name.toLowerCase().includes(modalSearch.toLowerCase())))
                            .map((a, idx) => (
                              <tr key={a.id || idx} className="hover:bg-blue-50/50">
                                <td className="p-2 font-bold text-gray-800">{a.name}</td>
                                <td className="p-2">
                                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800">
                                    {a.type === 'CASH' ? 'خزنة كاش' : (a.type === 'BANK' ? 'حساب بنكي' : 'محفظة إلكترونية')}
                                  </span>
                                </td>
                                <td className="p-2 text-emerald-700 font-semibold">{formatCurrency(a.total_in)}</td>
                                <td className="p-2 text-rose-700 font-semibold">{formatCurrency(a.total_out)}</td>
                                <td className="p-2 font-black text-blue-900 text-base">{formatCurrency(a.balance)}</td>
                                <td className="p-2 text-gray-600">{a.transactions_count || 0}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* كشف المصاريف */}
                  {modalType === 'expenses' && modalData.expenses && (
                    <div className="overflow-x-auto">
                      <div className="mb-3 p-2.5 bg-purple-50 text-purple-900 rounded-lg flex justify-between items-center text-xs font-bold">
                        <span>إجمالي المصاريف: {formatCurrency(modalData.total)}</span>
                        <span>عدد الحركات: {modalData.count}</span>
                      </div>
                      <table className="w-full text-right border-collapse text-xs md:text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-gray-700 border-b border-slate-200">
                            <th className="p-2 font-bold">التاريخ</th>
                            <th className="p-2 font-bold">نوع المصروف</th>
                            <th className="p-2 font-bold">البيان والتفاصيل</th>
                            <th className="p-2 font-bold">رقم الإيصال</th>
                            <th className="p-2 font-bold text-rose-700">المبلغ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {modalData.expenses
                            .filter(e => !modalSearch || (e.description && e.description.toLowerCase().includes(modalSearch.toLowerCase())) || (e.category && e.category.includes(modalSearch)))
                            .map((e, idx) => (
                              <tr key={e.id || idx} className="hover:bg-blue-50/50">
                                <td className="p-2 text-gray-600">{e.date}</td>
                                <td className="p-2 font-semibold text-gray-800">{e.category || e.sub_type}</td>
                                <td className="p-2 text-gray-800">{e.description || '-'}</td>
                                <td className="p-2 text-gray-500">{e.document_number || '-'}</td>
                                <td className="p-2 font-bold text-rose-700">{formatCurrency(e.amount)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* تفاصيل مكسبي في الفواتير */}
                  {modalType === 'profit' && modalData.items && (
                    <div className="overflow-x-auto space-y-3">
                      {modalData.summary && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-2.5 bg-blue-50 rounded-lg text-xs text-center font-bold">
                          <div>المبيعات: <strong className="text-blue-900 block">{formatCurrency(modalData.summary.total_revenue)}</strong></div>
                          <div>سعر التكلفة: <strong className="text-orange-900 block">{formatCurrency(modalData.summary.total_cogs)}</strong></div>
                          <div>مكسب البيع: <strong className="text-emerald-900 block">{formatCurrency(modalData.summary.gross_profit)}</strong></div>
                          <div>المصاريف: <strong className="text-purple-900 block">{formatCurrency(modalData.summary.total_expenses)}</strong></div>
                          <div>صافي المكسب: <strong className="text-green-900 block text-sm">{formatCurrency(modalData.summary.net_profit)}</strong></div>
                        </div>
                      )}
                      <table className="w-full text-right border-collapse text-xs md:text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-gray-700 border-b border-slate-200">
                            <th className="p-2 font-bold">الفاتورة</th>
                            <th className="p-2 font-bold">التاريخ</th>
                            <th className="p-2 font-bold">اسم العميل</th>
                            <th className="p-2 font-bold">الصنف</th>
                            <th className="p-2 font-bold">الكمية</th>
                            <th className="p-2 font-bold">سعر البيع</th>
                            <th className="p-2 font-bold">إجمالي البيع</th>
                            <th className="p-2 font-bold text-orange-700">سعر التكلفة</th>
                            <th className="p-2 font-bold text-emerald-800">مكسبي فيه</th>
                            <th className="p-2 font-bold">النسبة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {modalData.items
                            .filter(i => !modalSearch || (i.customer_name && i.customer_name.toLowerCase().includes(modalSearch.toLowerCase())) || (i.item_name && i.item_name.includes(modalSearch)) || (i.invoice_number && String(i.invoice_number).includes(modalSearch)))
                            .map((i, idx) => (
                              <tr key={i.id || idx} className="hover:bg-blue-50/50">
                                <td className="p-2 font-bold">#{i.invoice_number || i.sale_id}</td>
                                <td className="p-2 text-gray-600">{i.sale_date}</td>
                                <td className="p-2 font-semibold text-gray-800">{i.customer_name}</td>
                                <td className="p-2 text-gray-800">{i.item_name}</td>
                                <td className="p-2 font-semibold">{i.quantity} {i.unit}</td>
                                <td className="p-2">{formatCurrency(i.unit_price)}</td>
                                <td className="p-2 font-semibold text-blue-900">{formatCurrency(i.total_revenue)}</td>
                                <td className="p-2 text-orange-800 font-semibold">{formatCurrency(i.total_cost)}</td>
                                <td className="p-2 font-black text-emerald-800">{formatCurrency(i.gross_profit)}</td>
                                <td className="p-2 font-bold text-gray-700">{i.profit_margin}%</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">مفيش بيانات للعرض</div>
              )}
            </div>

            {/* زر الإغلاق */}
            <div className="p-3 bg-gray-100 border-t border-gray-200 flex justify-end">
              <button 
                onClick={closeModal}
                className="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default FinancialPositionView;
