const db = require('../db');
const fs = require('fs');
const puppeteer = require('puppeteer');

exports.getAllVehicles = (req, res) => {
    try {
        const vehicles = db.prepare('SELECT * FROM vehicles ORDER BY created_at DESC').all();
        res.json(vehicles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getVehicleById = (req, res) => {
    try {
        const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
        if (!vehicle) return res.status(404).json({ error: 'المركبة غير موجودة' });
        res.json(vehicle);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createVehicle = (req, res) => {
    const { name, type, plate_number, driver, notes } = req.body;
    try {
        const info = db.prepare(`
            INSERT INTO vehicles (name, type, plate_number, driver, notes) 
            VALUES (?, ?, ?, ?, ?)
        `).run(name, type, plate_number || '', driver || '', notes || '');
        res.json({ id: info.lastInsertRowid, message: 'تمت إضافة المركبة بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateVehicle = (req, res) => {
    const { name, type, plate_number, driver, status, notes } = req.body;
    try {
        db.prepare(`
            UPDATE vehicles SET 
            name = ?, type = ?, plate_number = ?, driver = ?, status = ?, notes = ?
            WHERE id = ?
        `).run(name, type, plate_number || '', driver || '', status || 'active', notes || '', req.params.id);
        res.json({ message: 'تم التحديث بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteVehicle = (req, res) => {
    try {
        const id = req.params.id;
        const txCount = db.prepare('SELECT COUNT(*) as count FROM transport_trips WHERE vehicle_id = ?').get(id).count;
        if (txCount > 0) return res.status(400).json({ error: 'لا يمكن حذف مركبة بها حركات مالية' });
        
        db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
        res.json({ message: 'تم حذف المركبة بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Helper function to build full vehicle report data
function buildVehicleReportData(vehicleId, periodType, fromDate, toDate) {
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
    if (!vehicle) return null;

    const now = new Date();
    let startDate = fromDate || '';
    let endDate = toDate || '';

    if (!startDate && !endDate && periodType) {
        if (periodType === 'daily') {
            const todayStr = now.toISOString().split('T')[0];
            startDate = todayStr;
            endDate = todayStr;
        } else if (periodType === 'weekly') {
            const d = new Date(now);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 6 ? 0 : -1 - day);
            const startOfWeek = new Date(d.setDate(diff));
            startDate = startOfWeek.toISOString().split('T')[0];
            endDate = now.toISOString().split('T')[0];
        } else if (periodType === 'monthly') {
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            startDate = `${y}-${m}-01`;
            const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
            endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
        } else if (periodType === 'yearly') {
            const y = now.getFullYear();
            startDate = `${y}-01-01`;
            endDate = `${y}-12-31`;
        }
    }

    // Prepare Date SQL Filters
    let tripDateFilter = '';
    let expenseDateFilter = '';
    let paramsTrips = [vehicleId, vehicle.name, vehicle.plate_number || '___NONE___'];
    let paramsExpenses = [vehicle.name, vehicle.plate_number || '___NONE___', String(vehicleId)];

    if (startDate && endDate) {
        tripDateFilter = ' AND date(t.trip_date) BETWEEN date(?) AND date(?)';
        paramsTrips.push(startDate, endDate);
        expenseDateFilter = ' AND date(e.expense_date) BETWEEN date(?) AND date(?)';
        paramsExpenses.push(startDate, endDate);
    } else if (startDate) {
        tripDateFilter = ' AND date(t.trip_date) >= date(?)';
        paramsTrips.push(startDate);
        expenseDateFilter = ' AND date(e.expense_date) >= date(?)';
        paramsExpenses.push(startDate);
    } else if (endDate) {
        tripDateFilter = ' AND date(t.trip_date) <= date(?)';
        paramsTrips.push(endDate);
        expenseDateFilter = ' AND date(e.expense_date) <= date(?)';
        paramsExpenses.push(endDate);
    }

    // Fetch Trips
    const trips = db.prepare(`
        SELECT t.*, s.name as supplier_name, c.name as customer_name
        FROM transport_trips t
        LEFT JOIN suppliers s ON t.supplier_id = s.id
        LEFT JOIN customers c ON t.customer_id = c.id
        WHERE (t.vehicle_id = ? OR t.vehicle = ? OR (t.plate_number = ? AND t.plate_number != '')) ${tripDateFilter}
        ORDER BY t.trip_date DESC, t.created_at DESC
    `).all(...paramsTrips);

    // Fetch Expenses
    const expenses = db.prepare(`
        SELECT e.*
        FROM expenses e
        WHERE e.status = 'active' AND (e.vehicle = ? OR e.vehicle = ? OR e.vehicle = ?) ${expenseDateFilter}
        ORDER BY e.expense_date DESC, e.created_at DESC
    `).all(...paramsExpenses);

    // Compute metrics
    let totalTransportRevenue = 0;
    let totalQuantity = 0;
    let completedTrips = 0;
    let cancelledTrips = 0;

    let tripFuel = 0;
    let tripMaintenance = 0;
    let tripOtherExpenses = 0;

    const workDatesSet = new Set();

    trips.forEach(t => {
        const nawlon = t.calc_method === 'per_ton' ? ((t.nawlon_cost || 0) * (t.quantity || 1)) : (t.nawlon_cost || 0);
        totalTransportRevenue += (nawlon || 0) + (t.revenues || 0);
        totalQuantity += (t.quantity || 0);

        if (t.status === 'cancelled' || t.status === 'ملغاة') {
            cancelledTrips++;
        } else {
            completedTrips++;
        }

        tripFuel += (t.fuel || 0);
        tripMaintenance += (t.maintenance || 0);
        tripOtherExpenses += (t.expenses || 0) + (t.gratuity_food || 0) + (t.commission || 0) + (t.advance_amount || 0);

        if (t.trip_date) {
            workDatesSet.add(String(t.trip_date).split('T')[0].split(' ')[0]);
        }
    });

    let extraFuel = 0;
    let extraMaintenance = 0;
    let extraOtherExpenses = 0;

    expenses.forEach(e => {
        const type = (e.expense_type || '').toLowerCase();
        const amt = parseFloat(e.amount) || 0;
        if (type.includes('بنزين') || type.includes('سولار') || type.includes('وقود') || type.includes('جاز')) {
            extraFuel += amt;
        } else if (type.includes('صيانة') || type.includes('إصلاح') || type.includes('قطع غيار') || type.includes('زيت')) {
            extraMaintenance += amt;
        } else {
            extraOtherExpenses += amt;
        }

        if (e.expense_date) {
            workDatesSet.add(String(e.expense_date).split('T')[0].split(' ')[0]);
        }
    });

    const totalFuel = tripFuel + extraFuel;
    const totalMaintenance = tripMaintenance + extraMaintenance;
    const totalOtherExpenses = tripOtherExpenses + extraOtherExpenses;
    const totalExpenses = totalFuel + totalMaintenance + totalOtherExpenses;
    const netResult = totalTransportRevenue - totalExpenses;
    const avgTripValue = trips.length > 0 ? (totalTransportRevenue / trips.length) : 0;
    const workDaysCount = workDatesSet.size;

    // Company Settings
    let companyName = 'الحاج رفعت للتجارة والنقل';
    try {
        const settingRow = db.prepare("SELECT value FROM settings WHERE key = 'company_name'").get();
        if (settingRow && settingRow.value) companyName = settingRow.value;
    } catch (err) {}

    return {
        companyName,
        vehicle,
        period: {
            periodType: periodType || 'custom',
            fromDate: startDate || 'الكل',
            toDate: endDate || 'الكل',
            created_at: new Date().toLocaleString('ar-EG')
        },
        financials: {
            totalTransportRevenue,
            totalExpenses,
            totalFuel,
            totalMaintenance,
            totalOtherExpenses,
            netResult
        },
        operationals: {
            totalTrips: trips.length,
            totalQuantity,
            avgTripValue,
            workDaysCount,
            completedTrips,
            cancelledTrips
        },
        trips,
        expenses
    };
}

exports.getVehicleReport = (req, res) => {
    try {
        const { id } = req.params;
        const { periodType, fromDate, toDate } = req.query;
        const reportData = buildVehicleReportData(id, periodType, fromDate, toDate);

        if (!reportData) {
            return res.status(404).json({ error: 'المركبة غير موجودة' });
        }

        res.json(reportData);
    } catch (error) {
        console.error('Vehicle Report Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.downloadVehicleReportPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const { periodType, fromDate, toDate } = req.query;
        const data = buildVehicleReportData(id, periodType, fromDate, toDate);

        if (!data) {
            return res.status(404).send('المركبة غير موجودة');
        }

        const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>تقرير العربية - ${data.vehicle.name}</title>
            <style>
                @page { size: A4 portrait; margin: 12mm; }
                * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    direction: rtl;
                    color: #1e293b;
                    background-color: #ffffff;
                    margin: 0;
                    padding: 0;
                    font-size: 10pt;
                }
                
                /* Executive Top Header Banner */
                .brand-header {
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    color: #ffffff;
                    padding: 18px 24px;
                    border-radius: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 18px;
                    border-bottom: 4px solid #3b82f6;
                }
                .brand-title h1 {
                    margin: 0;
                    font-size: 17pt;
                    font-weight: 800;
                    color: #ffffff;
                }
                .brand-title p {
                    margin: 4px 0 0 0;
                    font-size: 9.5pt;
                    color: #94a3b8;
                }
                .brand-badge-box {
                    text-align: left;
                }
                .vehicle-tag {
                    background: rgba(59, 130, 246, 0.25);
                    border: 1px solid #3b82f6;
                    color: #60a5fa;
                    padding: 4px 14px;
                    border-radius: 20px;
                    font-weight: 700;
                    font-size: 11pt;
                    display: inline-block;
                    margin-bottom: 4px;
                }
                .report-date {
                    font-size: 8.5pt;
                    color: #cbd5e1;
                }

                /* Section Title */
                .section-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 16px;
                    margin-bottom: 10px;
                }
                .section-title-icon {
                    width: 4px;
                    height: 16px;
                    background: #2563eb;
                    border-radius: 2px;
                }
                .section-title-text {
                    font-size: 11pt;
                    font-weight: 700;
                    color: #0f172a;
                }

                /* Metadata Grid */
                .meta-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    margin-bottom: 16px;
                }
                .meta-card {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 8px 12px;
                }
                .meta-label {
                    font-size: 8pt;
                    color: #64748b;
                    font-weight: 600;
                    margin-bottom: 2px;
                }
                .meta-value {
                    font-size: 10pt;
                    font-weight: 700;
                    color: #0f172a;
                }

                /* Executive KPI Cards */
                .kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    margin-bottom: 18px;
                }
                .kpi-card {
                    background: #ffffff;
                    border-radius: 10px;
                    padding: 12px 14px;
                    border: 1px solid #e2e8f0;
                    position: relative;
                    overflow: hidden;
                }
                .kpi-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    right: 0;
                    width: 4px;
                    height: 100%;
                }
                .kpi-card.blue::before { background: #2563eb; }
                .kpi-card.red::before { background: #dc2626; }
                .kpi-card.emerald::before { background: #16a34a; }
                .kpi-card.amber::before { background: #d97706; }
                .kpi-card.purple::before { background: #9333ea; }
                .kpi-card.slate::before { background: #475569; }

                .kpi-card.net-positive {
                    background: #f0fdf4;
                    border-color: #bbf7d0;
                }
                .kpi-card.net-negative {
                    background: #fff1f2;
                    border-color: #fecdd3;
                }

                .kpi-label {
                    font-size: 8.5pt;
                    font-weight: 700;
                    color: #475569;
                    margin-bottom: 4px;
                }
                .kpi-val {
                    font-size: 14pt;
                    font-weight: 800;
                    color: #0f172a;
                    line-height: 1.1;
                }
                .kpi-unit {
                    font-size: 8.5pt;
                    font-weight: 600;
                    color: #64748b;
                }

                /* Financial Table */
                .styled-table {
                    width: 100%;
                    border-collapse: collapse;
                    border-radius: 8px;
                    overflow: hidden;
                    border: 1px solid #cbd5e1;
                    margin-bottom: 18px;
                }
                .styled-table th {
                    background: #1e293b;
                    color: #ffffff;
                    padding: 10px 12px;
                    font-size: 8.5pt;
                    font-weight: 700;
                    text-align: center;
                    border: 1px solid #334155;
                }
                .styled-table td {
                    padding: 10px 12px;
                    font-size: 9.5pt;
                    text-align: center;
                    border: 1px solid #e2e8f0;
                    color: #334155;
                }
                .styled-table tbody tr:nth-child(even) {
                    background-color: #f8fafc;
                }

                .approval-section {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 25px;
                    padding-top: 15px;
                    border-top: 1px dashed #cbd5e1;
                }
                .sig-box {
                    text-align: center;
                    width: 180px;
                }
                .sig-title {
                    font-size: 8.5pt;
                    font-weight: 700;
                    color: #475569;
                    margin-bottom: 25px;
                }
                .sig-line {
                    border-bottom: 1px solid #94a3b8;
                    width: 130px;
                    margin: 0 auto;
                }

                .footer {
                    margin-top: 20px;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 8px;
                    text-align: center;
                    font-size: 8pt;
                    color: #94a3b8;
                }
            </style>
        </head>
        <body>
            <!-- Executive Banner -->
            <div class="brand-header">
                <div class="brand-title">
                    <h1>تقرير التصفية الحسابية - ${data.vehicle.name}</h1>
                    <p>${data.companyName} | الفترة: من ${data.period.fromDate} إلى ${data.period.toDate}</p>
                </div>
                <div class="brand-badge-box">
                    <div class="vehicle-tag">🚛 ${data.vehicle.name} (${data.vehicle.type || 'عربية'})</div>
                    <div class="report-date">تاريخ الاستخراج: ${data.period.created_at}</div>
                </div>
            </div>

            <!-- 2. كروت ملخص العربية الحسابية -->
            <div class="section-header">
                <div class="section-title-icon" style="background: #16a34a;"></div>
                <div class="section-title-text">مؤشرات الأداء المالي الحسابية</div>
            </div>
            <div class="kpi-grid">
                <div class="kpi-card blue">
                    <div class="kpi-label">إجمالي إيرادات النقل</div>
                    <div class="kpi-val" style="color: #1e40af;">${Number(data.financials.totalTransportRevenue).toLocaleString()} <span class="kpi-unit">ج.م</span></div>
                </div>
                <div class="kpi-card red">
                    <div class="kpi-label">إجمالي المصروفات</div>
                    <div class="kpi-val" style="color: #991b1b;">${Number(data.financials.totalExpenses).toLocaleString()} <span class="kpi-unit">ج.م</span></div>
                </div>
                <div class="kpi-card ${data.financials.netResult >= 0 ? 'emerald net-positive' : 'red net-negative'}">
                    <div class="kpi-label" style="color: ${data.financials.netResult >= 0 ? '#166534' : '#991b1b'};">صافي نتيجة العربية</div>
                    <div class="kpi-val" style="color: ${data.financials.netResult >= 0 ? '#15803d' : '#b91c1c'};">
                        ${Number(data.financials.netResult).toLocaleString()} <span class="kpi-unit">ج.م</span>
                    </div>
                </div>
                <div class="kpi-card amber">
                    <div class="kpi-label">مصروفات الوقود والسولار</div>
                    <div class="kpi-val" style="color: #92400e;">${Number(data.financials.totalFuel).toLocaleString()} <span class="kpi-unit">ج.م</span></div>
                </div>
                <div class="kpi-card purple">
                    <div class="kpi-label">مصروفات الصيانة والإصلاح</div>
                    <div class="kpi-val" style="color: #6b21a8;">${Number(data.financials.totalMaintenance).toLocaleString()} <span class="kpi-unit">ج.م</span></div>
                </div>
                <div class="kpi-card slate">
                    <div class="kpi-label">مصروفات إضافية أخرى</div>
                    <div class="kpi-val" style="color: #334155;">${Number(data.financials.totalOtherExpenses).toLocaleString()} <span class="kpi-unit">ج.م</span></div>
                </div>
            </div>

            <!-- 3. جدول التحليل الحسابي التفصيلي -->
            <div class="section-header">
                <div class="section-title-icon" style="background: #0f172a;"></div>
                <div class="section-title-text">جدول تحليل وتوزيع النتائج المالية</div>
            </div>
            <table class="styled-table">
                <thead>
                    <tr>
                        <th>إجمالي إيرادات النقل</th>
                        <th>إجمالي المصروفات</th>
                        <th>وقود / سولار</th>
                        <th>صيانة وإصلاح</th>
                        <th>مصروفات أخرى</th>
                        <th>صافي نتيجة العربية</th>
                        <th>عدد الرحلات</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="font-weight: bold; color: #2563eb;">${Number(data.financials.totalTransportRevenue).toLocaleString()} ج.م</td>
                        <td style="font-weight: bold; color: #dc2626;">${Number(data.financials.totalExpenses).toLocaleString()} ج.م</td>
                        <td>${Number(data.financials.totalFuel).toLocaleString()} ج.م</td>
                        <td>${Number(data.financials.totalMaintenance).toLocaleString()} ج.م</td>
                        <td>${Number(data.financials.totalOtherExpenses).toLocaleString()} ج.م</td>
                        <td style="font-weight: bold; color: ${data.financials.netResult >= 0 ? '#16a34a' : '#dc2626'}; background: ${data.financials.netResult >= 0 ? '#f0fdf4' : '#fff1f2'};">
                            ${Number(data.financials.netResult).toLocaleString()} ج.م
                        </td>
                        <td style="font-weight: bold;">${data.operationals.totalTrips} رحلة</td>
                    </tr>
                </tbody>
            </table>

            <!-- توقيعات الاعتماد الرسمي -->
            <div class="approval-section">
                <div class="sig-box">
                    <div class="sig-title">إعداد الحسابات</div>
                    <div class="sig-line"></div>
                </div>
                <div class="sig-box">
                    <div class="sig-title">مراجعة إدارة الحركة</div>
                    <div class="sig-line"></div>
                </div>
                <div class="sig-box">
                    <div class="sig-title">يعتمد المدير العام</div>
                    <div class="sig-line"></div>
                </div>
            </div>

            <div class="footer">
                نظام إدارة الحسابات والنقل - تم التوليد آلياً من ${data.companyName} بتاريخ ${data.period.created_at}
            </div>
        </body>
        </html>
        `;

        let executablePath;
        const possiblePaths = [
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        ];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                executablePath = p;
                break;
            }
        }

        const browser = await puppeteer.launch({
            ...(executablePath ? { executablePath } : {}),
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }
        });
        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="vehicle_report_${id}.pdf"`);
        res.end(Buffer.from(pdfBuffer));
    } catch (error) {
        console.error('Vehicle Report PDF Error:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إنتاج ملف PDF للتقرير: ' + error.message });
    }
};
