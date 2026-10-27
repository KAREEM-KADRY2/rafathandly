import React, { useState, useEffect } from 'react';
import { Play, Trash2, StopCircle, RefreshCw, Cpu, Database, CheckCircle, AlertTriangle, XCircle, ShieldCheck, Activity, FileText, Zap, BarChart2, Layers } from 'lucide-react';
import api from '../api';

export default function StressTestPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [concurrencyData, setConcurrencyData] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [failureTestsData, setFailureTestsData] = useState(null);
  const [actionMessage, setActionMessage] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await api.get('/stress-test/status');
      setStatus(res.data);
    } catch (err) {
      console.error('Error fetching stress test status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleStartTest = async () => {
    if (!window.confirm('هل أنت تأكد من بدء اختبار الضغط وإنشاء 170,000+ سجل اختبار؟ سيتم تنفيذ الاختبار على قاعدة بيانات الاختبار المعزولة.')) return;
    try {
      setLoading(true);
      setActionMessage('جاري بدء اختبار الضغط في الخلفية...');
      await api.post('/stress-test/start');
      fetchStatus();
    } catch (err) {
      alert(err.response?.data?.error || 'حدث خطأ أثناء بدء الاختبار');
    } finally {
      setLoading(false);
    }
  };

  const handleStopTest = async () => {
    try {
      await api.post('/stress-test/stop');
      setActionMessage('تم إرسال طلب إيقاف الاختبار');
      fetchStatus();
    } catch (err) {
      alert('حدث خطأ أثناء الإيقاف');
    }
  };

  const handleDeleteTestData = async () => {
    if (!window.confirm('هل أنت متأكد من مسح جميع بيانات الاختبار المنشأة؟ لن يتم مسح البيانات الحقيقية نهائياً.')) return;
    try {
      setLoading(true);
      setActionMessage('جاري مسح بيانات الاختبار...');
      const res = await api.post('/stress-test/delete');
      setActionMessage(res.data.message);
      fetchStatus();
    } catch (err) {
      alert('حدث خطأ أثناء مسح بيانات الاختبار');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchDb = async (mode) => {
    try {
      setLoading(true);
      const res = await api.post('/stress-test/switch-db', { mode });
      setActionMessage(res.data.message);
      fetchStatus();
    } catch (err) {
      alert('حدث خطأ أثناء تبديل قاعدة البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleRunConcurrency = async () => {
    try {
      setLoading(true);
      setActionMessage('جاري تشغيل اختبار الأحمال المتزامنة (10, 25, 50, 100 مستخدم)...');
      const res = await api.post('/stress-test/concurrency', { levels: [10, 25, 50, 100] });
      setConcurrencyData(res.data.results);
      setActionMessage('اكتمل اختبار الأحمال المتزامنة بنجاح!');
    } catch (err) {
      alert('حدث خطأ أثناء اختبار الأحمال المتزامنة');
    } finally {
      setLoading(false);
    }
  };

  const handleRunAudit = async () => {
    try {
      setLoading(true);
      setActionMessage('جاري فحص النزاهة والحسابات المالية والمخزن...');
      const res = await api.get('/stress-test/audit');
      setAuditData(res.data);
      setActionMessage('اكتمل فحص النزاهة!');
    } catch (err) {
      alert('حدث خطأ أثناء فحص النزاهة');
    } finally {
      setLoading(false);
    }
  };

  const handleRunFailureTests = async () => {
    try {
      setLoading(true);
      setActionMessage('جاري اختبار سيناريوهات الفشل والتراجع (Rollback)...');
      const res = await api.post('/stress-test/failure-tests');
      setFailureTestsData(res.data.testResults);
      setActionMessage('اكتمل اختبار الفشل والتراجع بنجاح!');
    } catch (err) {
      alert('حدث خطأ أثناء اختبار سيناريوهات الفشل');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setLoading(true);
      setActionMessage('جاري توليد التقرير الشامل والتأكد من كافة المؤشرات...');
      const res = await api.get('/stress-test/report');
      setReport(res.data);
      if (res.data.concurrencyBenchmark) setConcurrencyData(res.data.concurrencyBenchmark);
      if (res.data.dataIntegrityAudit) setAuditData(res.data.dataIntegrityAudit);
      if (res.data.failureTests) setFailureTestsData(res.data.failureTests);
      setActionMessage('تم إنشاء تقرير الأداء النهائي!');
    } catch (err) {
      alert('حدث خطأ أثناء توليد التقرير');
    } finally {
      setLoading(false);
    }
  };

  const counts = status?.counts || {};
  const targets = status?.targets || {};

  const items = [
    { label: 'العملاء', icon: '👥', current: counts.customers || 0, target: targets.customers || 1000 },
    { label: 'الموردين', icon: '🏭', current: counts.suppliers || 0, target: targets.suppliers || 10000 },
    { label: 'المصانع', icon: '🏬', current: counts.factories || 0, target: targets.factories || 1000 },
    { label: 'العمال والموظفين', icon: '👷', current: counts.employees || 0, target: targets.employees || 1000 },
    { label: 'المنتجات وأصناف البناء', icon: '📦', current: counts.products || 0, target: targets.products || 5000 },
    { label: 'إيداعات رصيد المصانع', icon: '💰', current: counts.factory_deposits || 0, target: targets.factory_deposits || 5000 },
    { label: 'فواتير الشراء', icon: '🛒', current: counts.purchases || 0, target: targets.purchases || 20000 },
    { label: 'مدفوعات الموردين', icon: '💸', current: counts.supplier_payments || 0, target: targets.supplier_payments || 10000 },
    { label: 'فواتير المبيعات', icon: '💵', current: counts.sales || 0, target: targets.sales || 20000 },
    { label: 'تحصيلات العملاء', icon: '🧾', current: counts.customer_payments || 0, target: targets.customer_payments || 10000 },
    { label: 'المصروفات والنثريات', icon: '🏷️', current: counts.expenses || 0, target: targets.expenses || 10000 },
    { label: 'سندات القبض (الخزينة)', icon: '📑', current: counts.receipt_vouchers || 0, target: targets.receipt_vouchers || 10000 },
    { label: 'سندات الصرف (الخزينة)', icon: '📄', current: counts.payment_vouchers || 0, target: targets.payment_vouchers || 10000 },
    { label: 'حركات المخزون والتدقيق', icon: '📊', current: counts.inventory_movements || 0, target: targets.inventory_movements || 40000 },
  ];

  return (
    <div dir="rtl" className="space-y-6 pb-12">
      {/* Header & Title */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="text-blue-400" size={28} />
            <h1 className="text-2xl font-bold">اختبار ضغط النظام - Real Load & Stress Test</h1>
          </div>
          <p className="text-slate-400 text-sm">
            منظومة اختبار الأحمال الكبيرة، الحسابات المالية المركبة، نزاهة المخزون، والأداء بالتوازي (100k+ records).
          </p>
        </div>

        {/* DB Active Indicator */}
        <div className="flex items-center gap-3 bg-slate-800 p-2.5 rounded-xl border border-slate-700">
          <Database size={20} className={status?.isTestDb ? "text-emerald-400" : "text-amber-400"} />
          <div>
            <p className="text-xs text-slate-400">قاعدة البيانات النشطة حالياً:</p>
            <p className={`text-sm font-bold ${status?.isTestDb ? "text-emerald-400" : "text-amber-300"}`}>
              {status?.isTestDb ? "🟢 قاعدة البيانات الاختبارية المعزولة (TEST DB)" : "🔵 قاعدة البيانات الحقيقية (PRODUCTION DB)"}
            </p>
          </div>

          <div className="flex gap-1 mr-2">
            <button
              onClick={() => handleSwitchDb('test')}
              disabled={status?.isTestDb}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${status?.isTestDb ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
              اختبار
            </button>
            <button
              onClick={() => handleSwitchDb('production')}
              disabled={!status?.isTestDb}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!status?.isTestDb ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
            >
              حقيقي
            </button>
          </div>
        </div>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div className="bg-blue-50 border-right-4 border-blue-600 p-4 rounded-xl text-blue-900 font-semibold text-sm flex items-center gap-2">
          <Zap size={18} className="text-blue-600" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Main Buttons Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap items-center gap-3">
        <button
          onClick={handleStartTest}
          disabled={status?.isRunning || loading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all text-sm disabled:opacity-50 cursor-pointer"
        >
          <Play size={18} />
          بدء اختبار الضغط (1 Click)
        </button>

        {status?.isRunning && (
          <button
            onClick={handleStopTest}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all text-sm cursor-pointer"
          >
            <StopCircle size={18} />
            إيقاف الاختبار
          </button>
        )}

        <button
          onClick={handleDeleteTestData}
          disabled={status?.isRunning || loading}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all text-sm disabled:opacity-50 cursor-pointer"
        >
          <Trash2 size={18} />
          مسح بيانات الاختبار
        </button>

        <div className="h-6 w-px bg-gray-300 mx-1 hidden sm:block"></div>

        <button
          onClick={handleRunConcurrency}
          disabled={status?.isRunning || loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all text-sm disabled:opacity-50 cursor-pointer"
        >
          <Activity size={18} />
          اختبار الأحمال المتزامنة
        </button>

        <button
          onClick={handleRunAudit}
          disabled={status?.isRunning || loading}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all text-sm disabled:opacity-50 cursor-pointer"
        >
          <ShieldCheck size={18} />
          فحص النزاهة
        </button>

        <button
          onClick={handleRunFailureTests}
          disabled={status?.isRunning || loading}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all text-sm disabled:opacity-50 cursor-pointer"
        >
          <Layers size={18} />
          اختبار التراجع والخطأ
        </button>

        <button
          onClick={handleGenerateReport}
          disabled={loading}
          className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all text-sm disabled:opacity-50 mr-auto cursor-pointer"
        >
          <FileText size={18} />
          التقرير النهائي الشامل
        </button>
      </div>

      {/* Execution Status Banner */}
      <div className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700 flex flex-wrap justify-between items-center gap-4">
        <div>
          <p className="text-xs text-slate-400">حالة عملية الاختبار:</p>
          <p className="text-base font-bold text-blue-300">{status?.currentPhase || 'جاهز'}</p>
        </div>

        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-slate-400 text-xs block">حجم قاعدة البيانات:</span>
            <span className="font-bold text-emerald-400 text-base">{status?.dbSizeMB || 0} MB</span>
          </div>
          <div>
            <span className="text-slate-400 text-xs block">استهلاك الذاكرة (RAM):</span>
            <span className="font-bold text-amber-400 text-base">{status?.memoryUsageMB || 0} MB</span>
          </div>
          <div>
            <span className="text-slate-400 text-xs block">الوقت المستغرق:</span>
            <span className="font-bold text-slate-200 text-base">{Math.round((status?.elapsedMs || 0) / 1000)} ثانية</span>
          </div>
        </div>
      </div>

      {/* Progress Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item, idx) => {
          const pct = Math.min(100, Math.round((item.current / (item.target || 1)) * 100));
          return (
            <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {pct}%
                </span>
              </div>
              <p className="text-sm font-bold text-gray-800 mb-1">{item.label}</p>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-lg font-bold text-blue-600" dir="ltr">{item.current.toLocaleString()}</span>
                <span className="text-xs text-gray-500" dir="ltr">/ {item.target.toLocaleString()}</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                  style={{ width: `${pct}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Final Evaluation Report Banner (if generated) */}
      {report && (
        <div className="space-y-6">
          <div className={`p-6 rounded-2xl shadow-md border text-white ${report.overallVerdict === 'PASS' ? 'bg-emerald-900 border-emerald-700' : report.overallVerdict === 'WARNING' ? 'bg-amber-900 border-amber-700' : 'bg-red-900 border-red-700'}`}>
            <div className="flex items-center gap-3 mb-2">
              {report.overallVerdict === 'PASS' && <CheckCircle size={36} className="text-emerald-300" />}
              {report.overallVerdict === 'WARNING' && <AlertTriangle size={36} className="text-amber-300" />}
              {report.overallVerdict === 'FAIL' && <XCircle size={36} className="text-red-300" />}
              <div>
                <h2 className="text-2xl font-bold">النتيجة والتقييم النهائي للنظام: {report.overallVerdict}</h2>
                <p className="text-sm opacity-90">{report.verdictReason}</p>
              </div>
            </div>
          </div>

          {/* Page Assessments Table */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart2 className="text-blue-600" size={20} />
              تقييم أداء وصفحات النظام الرئيسية تحت الحمل العالي
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 border-b">
                    <th className="p-3">الصفحة / الموديول</th>
                    <th className="p-3">متوسط زمن الاستجابة</th>
                    <th className="p-3">التقييم (PASS/WARN/FAIL)</th>
                    <th className="p-3">ملاحظات الأداء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(report.pagesAssessment || {}).map(([page, details], index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-3 font-bold text-gray-800">{page}</td>
                      <td className="p-3" dir="ltr">{details.avgTimeMs} ms</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${details.status === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {details.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600">{details.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Concurrency Benchmark Data */}
      {concurrencyData && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Zap className="text-amber-500" size={20} />
            نتائج اختبار الأحمال المتزامنة (10, 25, 50, 100 مستخدم بالتوازي)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-3">المستخدمين بالتوازي</th>
                  <th className="p-3">إجمالي الطلبات</th>
                  <th className="p-3">الناجحة</th>
                  <th className="p-3">الفاشلة</th>
                  <th className="p-3">متوسط الاستجابة</th>
                  <th className="p-3">أبطأ طلب (Max)</th>
                  <th className="p-3">P95 Latency</th>
                  <th className="p-3">المعدل (Req/Sec)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {concurrencyData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 font-semibold">
                    <td className="p-3 font-bold text-blue-700">{row.concurrency} مستخدمين</td>
                    <td className="p-3" dir="ltr">{row.totalRequests}</td>
                    <td className="p-3 text-emerald-600" dir="ltr">{row.successfulRequests}</td>
                    <td className="p-3 text-red-600" dir="ltr">{row.failedRequests}</td>
                    <td className="p-3" dir="ltr">{row.avgLatencyMs} ms</td>
                    <td className="p-3" dir="ltr">{row.maxLatencyMs} ms</td>
                    <td className="p-3" dir="ltr">{row.p95LatencyMs} ms</td>
                    <td className="p-3 text-emerald-700 font-bold" dir="ltr">{row.requestsPerSec} req/s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Integrity Results */}
      {auditData && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ShieldCheck className="text-emerald-600" size={20} />
            نتائج فحص النزاهة والحسابات المالية والمخزن
          </h3>

          <div className="space-y-3">
            <div className={`p-4 rounded-xl border flex items-center justify-between ${auditData.isHealthy ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
              <div className="flex items-center gap-2 font-bold">
                {auditData.isHealthy ? <CheckCircle size={20} className="text-emerald-600" /> : <XCircle size={20} className="text-red-600" />}
                <span>حالة سلامة ونزاهة الحسابات الإجمالية:</span>
              </div>
              <span className="font-bold text-base">{auditData.isHealthy ? 'سليمة 100% 🟢' : 'يوجد ملاحظات 🔴'}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 p-4 rounded-xl border">
                <p className="font-bold text-gray-800 mb-1">فحص المفاتيح الأجنبية (Foreign Keys):</p>
                <p className="text-gray-600">{auditData.foreignKeysCheck?.length === 0 ? 'لا توجد أي أخطاء أو قيود مفقودة' : `${auditData.foreignKeysCheck?.length} خطأ`}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border">
                <p className="font-bold text-gray-800 mb-1">فحص تكرار الفواتير والسندات:</p>
                <p className="text-gray-600">{auditData.duplicateInvoices?.length === 0 ? 'لا توجد فواتير مكررة' : `${auditData.duplicateInvoices?.length} فاتورة مكررة`}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Failure & Rollback Test Scenarios */}
      {failureTestsData && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Layers className="text-purple-600" size={20} />
            نتائج اختبار سيناريوهات الفشل والتراجع (Transaction Rollback)
          </h3>

          <div className="space-y-3">
            {failureTestsData.map((test, idx) => (
              <div key={idx} className="p-4 rounded-xl border bg-slate-50 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-800">{test.name}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{test.detail}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${test.status === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  {test.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
