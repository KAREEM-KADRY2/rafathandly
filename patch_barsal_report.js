const fs = require('fs');

let brPath = 'c:/Users/xps/Desktop/الحاج رفعت/frontend/src/components/BarsalReport.jsx';
let br = fs.readFileSync(brPath, 'utf8');

// 1. Add Trash2 to imports
br = br.replace(
  "Check, X, RefreshCw, Share2, Eye, ShieldCheck, Copy",
  "Check, X, RefreshCw, Share2, Eye, ShieldCheck, Copy, Trash2"
);

// 2. Add delete functions right after fetchReport
const deleteFuncs = `  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السجل نهائياً؟')) return;
    try {
      await api.delete(\`/barsal/\${recordId}\`);
      fetchReport();
      fetchParcels();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'حدث خطأ أثناء حذف السجل');
    }
  };

  const handleDeleteParcel = async (villa, barsal) => {
    if (!window.confirm(\`هل أنت متأكد من حذف جميع حركات برسل \${barsal} (فيلا \${villa})؟\`)) return;
    try {
      await api.post('/barsal/delete-parcel', { villa, barsal });
      fetchReport();
      fetchParcels();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'حدث خطأ أثناء حذف البرسل');
    }
  };

  // Auto fetch whenever primary filters change`;

br = br.replace('  // Auto fetch whenever primary filters change', deleteFuncs);

// 3. Add table header for Actions in detailed view
br = br.replace(
  `<th className="p-3 text-center w-28 no-print">حالة السداد</th>`,
  `<th className="p-3 text-center w-28 no-print border-l border-slate-200">حالة السداد</th>
                        <th className="p-3 text-center w-20 no-print">الإجراءات</th>`
);

// 4. Add table cell for Actions in row
const oldRowEnd = `                              </span>
                            </td>
                          </tr>`;

const newRowEnd = `                              </span>
                            </td>
                            <td className="p-3 text-center no-print border-l border-slate-100">
                              <button
                                onClick={() => handleDeleteRecord(t.id)}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded-lg transition-colors font-bold inline-flex items-center justify-center"
                                title="حذف هذا السجل"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>`;

br = br.replace(oldRowEnd, newRowEnd);

// 5. Update footer colSpan if needed
br = br.replace(
  `<td className="p-3 no-print"></td>`,
  `<td className="p-3 no-print border-l border-slate-800"></td>
                        <td className="p-3 no-print"></td>`
);

// 6. In grouped view, add Delete button for parcel
const oldGroupedBtn = `                      {/* Action to Filter by this Villa */}
                      <button
                        onClick={() => {
                          setSelectedVilla(grp.villa);
                          setViewMode('detailed');
                        }}
                        className="w-full mt-2 py-1.5 bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
                      >
                        <Eye size={13} />
                        <span>فتح كشف الحساب التفصيلي</span>
                      </button>`;

const newGroupedBtn = `                      {/* Action to Filter by this Villa + Delete */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          onClick={() => {
                            setSelectedVilla(grp.villa);
                            setViewMode('detailed');
                          }}
                          className="flex-1 py-1.5 bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
                        >
                          <Eye size={13} />
                          <span>كشف الحساب</span>
                        </button>
                        <button
                          onClick={() => handleDeleteParcel(grp.villa, grp.barsal)}
                          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
                          title="حذف البرسل بالكامل"
                        >
                          <Trash2 size={13} />
                          <span>حذف</span>
                        </button>
                      </div>`;

br = br.replace(oldGroupedBtn, newGroupedBtn);

fs.writeFileSync(brPath, br, 'utf8');
console.log('BarsalReport.jsx updated successfully');
