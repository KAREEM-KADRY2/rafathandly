import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-slate-50 min-h-[400px] flex flex-col items-center justify-center text-center rounded-2xl border border-slate-200 shadow-sm" dir="rtl">
          <div className="bg-red-100 p-4 rounded-full mb-4">
            <AlertTriangle size={36} className="text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">حدث خطأ أثـناء عرض البيانات</h2>
          <p className="text-slate-500 text-sm max-w-md mb-6">
            تعذر تحميل الشاشة المطلوبة بسبب خطأ غير متوقع. اضغط على الزر أدناه لإعادة تحميل الصفحة.
          </p>
          <button
            onClick={this.handleReset}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-all"
          >
            <RefreshCw size={18} />
            إعادة تحديث الشاشة
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
