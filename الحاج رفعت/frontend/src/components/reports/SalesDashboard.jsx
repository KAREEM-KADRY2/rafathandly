import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const formatCurrency = (val) => new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(val || 0);

export default function SalesDashboard({ data, dateRange }) {
  const [productData, setProductData] = useState([]);
  
  useEffect(() => {
    // Fetch product sales data for the charts
    const fetchProducts = async () => {
      try {
        const params = new URLSearchParams();
        if (dateRange.startDate) params.append('startDate', dateRange.startDate);
        if (dateRange.endDate) params.append('endDate', dateRange.endDate);
        const res = await axios.get(`/api/reports-v2/all-products?${params.toString()}`);
        setProductData(res.data.filter(p => p.sold_qty > 0)); // Only show sold items
      } catch (err) {
        console.error(err);
      }
    };
    fetchProducts();
  }, [dateRange]);

  if (!data || !data.sales) return null;

  // Process data for "Sales & Profit Chart"
  // Group sales by date
  const groupedSales = data.sales.reduce((acc, sale) => {
    const d = new Date(sale.sale_date).toLocaleDateString('ar-EG');
    if (!acc[d]) acc[d] = { name: d, المبيعات: 0, التكلفة: 0, 'الربح الصافي': 0 };
    acc[d].المبيعات += (sale.original_amount || 0);
    acc[d].التكلفة += (sale.cost || 0);
    acc[d]['الربح الصافي'] += (sale.profit || 0);
    return acc;
  }, {});
  
  const chartData = Object.values(groupedSales).reverse(); // Reverse for chronological if it's desc

  return (
    <div className="space-y-8 mt-6">
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Sales & Profit Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6">مؤشر المبيعات والأرباح</h3>
          <div className="h-80 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" tick={{fill: '#6b7280'}} />
                <YAxis tick={{fill: '#6b7280'}} tickFormatter={(value) => `${value / 200}k`} />
                <Tooltip formatter={(value) => formatCurrency(value)} labelStyle={{color: '#374151'}} />
                <Legend wrapperStyle={{paddingTop: '20px'}} />
                <Line type="monotone" dataKey="المبيعات" stroke="#3b82f6" strokeWidth={3} dot={{r: 4}} activeDot={{r: 8}} />
                <Line type="monotone" dataKey="التكلفة" stroke="#ef4444" strokeWidth={3} />
                <Line type="monotone" dataKey="الربح الصافي" stroke="#10b981" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales By Product Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6">المبيعات حسب الصنف</h3>
          <div className="h-80 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productData.slice(0, 7)} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" tick={{fill: '#6b7280'}} />
                <YAxis tick={{fill: '#6b7280'}} tickFormatter={(value) => `${value / 200}k`} />
                <Tooltip formatter={(value) => formatCurrency(value)} cursor={{fill: 'transparent'}} />
                <Legend wrapperStyle={{paddingTop: '20px'}} />
                <Bar dataKey="sales_revenue" name="إجمالي المبيعات" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="الربح" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
      </div>
      
      {/* Product Details Table */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">تفاصيل الأصناف المباعة</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-right text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500">الصنف</th>
                <th className="px-4 py-3 font-medium text-gray-500">الكمية المباعة</th>
                <th className="px-4 py-3 font-medium text-gray-500">قيمة المبيعات</th>
                <th className="px-4 py-3 font-medium text-gray-500">إجمالي التكلفة</th>
                <th className="px-4 py-3 font-medium text-gray-500">صافي الربح</th>
                <th className="px-4 py-3 font-medium text-gray-500">هامش الربح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {productData.map((p, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-bold text-gray-700">{p.name}</td>
                  <td className="px-4 py-3">{p.sold_qty}</td>
                  <td className="px-4 py-3 text-indigo-600 font-bold" dir="ltr">{formatCurrency(p.sales_revenue)}</td>
                  <td className="px-4 py-3 text-red-600" dir="ltr">{formatCurrency(p.sold_qty * p.avg_unit_cost)}</td>
                  <td className="px-4 py-3 text-emerald-600 font-bold" dir="ltr">{formatCurrency(p.profit)}</td>
                  <td className="px-4 py-3 font-medium text-gray-500">
                    {p.sales_revenue > 0 ? ((p.profit / p.sales_revenue) * 20).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
              {productData.length === 0 && (
                <tr><td colSpan="6" className="p-4 text-center text-gray-400">لا توجد مبيعات في هذه الفترة</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
