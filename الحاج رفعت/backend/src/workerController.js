const db = require('../db');
const auditLogger = require('./auditLogger');
const treasuryController = require('./treasuryController');

exports.getAllWorkers = (req, res) => {
    try {
        if (req.query.all === 'true' || (!req.query.page && !req.query.limit && !req.query.search)) {
            const workers = db.prepare('SELECT id, name, phone, job_title FROM workers ORDER BY name ASC').all();
            return res.json(workers);
        }

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;

        const search = req.query.search ? req.query.search.trim() : '';
        const sortByParam = req.query.sortBy || 'name';
        const sortOrderParam = (req.query.sortOrder || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        const allowedSortColumns = {
            id: 'w.id',
            name: 'w.name',
            phone: 'w.phone',
            job_title: 'w.job_title',
            monthly_salary: 'w.monthly_salary'
        };

        const sortColumn = allowedSortColumns[sortByParam] || 'w.name';

        let whereClause = '';
        const params = [];

        if (search) {
            whereClause = ' WHERE (w.name LIKE ? OR w.phone LIKE ? OR w.job_title LIKE ? OR w.notes LIKE ?)';
            const sParam = `%${search}%`;
            params.push(sParam, sParam, sParam, sParam);
        }

        const countStmt = db.prepare(`SELECT COUNT(*) as total FROM workers w${whereClause}`);
        const total = countStmt.get(...params).total;

        const query = `
            SELECT w.*, 
                   ob.amount as opening_balance_amount, 
                   ob.balance_type as opening_balance_type, 
                   ob.effective_date as opening_balance_date,
                   ob.notes as opening_balance_notes
            FROM workers w
            LEFT JOIN opening_balances ob ON ob.entity_type = 'worker' AND ob.entity_id = w.id
            ${whereClause}
            ORDER BY ${sortColumn} ${sortOrderParam}
            LIMIT ? OFFSET ?
        `;

        const items = db.prepare(query).all(...params, limit, offset);
        const totalPages = Math.ceil(total / limit) || 1;

        res.json({
            items,
            total,
            page,
            limit,
            totalPages
        });
    } catch (error) {
        console.error('Error in getAllWorkers:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.createWorker = (req, res) => {
    const { name, phone, job_title, notes, monthly_salary, status } = req.body;
    try {
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'يرجى إدخال اسم العامل' });
        }
        const salaryVal = parseFloat(monthly_salary);
        const finalSalary = isNaN(salaryVal) ? 0 : salaryVal;

        const info = db.prepare(`
            INSERT INTO workers (name, phone, job_title, notes, monthly_salary, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(name.trim(), phone ? phone.trim() : '', job_title ? job_title.trim() : '', notes ? notes.trim() : '', finalSalary, status || 'active');
        
        res.status(201).json({ id: info.lastInsertRowid, message: 'تم إضافة العامل بنجاح' });
    } catch (error) {
        console.error('Error in createWorker:', error);
        res.status(400).json({ error: error.message || 'حدث خطأ أثناء إضافة العامل' });
    }
};

exports.updateWorker = (req, res) => {
    const { name, phone, job_title, notes, monthly_salary, status } = req.body;
    try {
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'يرجى إدخال اسم العامل' });
        }
        const salaryVal = parseFloat(monthly_salary);
        const finalSalary = isNaN(salaryVal) ? 0 : salaryVal;

        db.prepare(`
            UPDATE workers 
            SET name = ?, phone = ?, job_title = ?, notes = ?, monthly_salary = ?, status = ?
            WHERE id = ?
        `).run(name.trim(), phone ? phone.trim() : '', job_title ? job_title.trim() : '', notes ? notes.trim() : '', finalSalary, status || 'active', req.params.id);
        
        res.json({ message: 'تم تحديث البيانات بنجاح' });
    } catch (error) {
        console.error('Error in updateWorker:', error);
        res.status(400).json({ error: error.message || 'حدث خطأ أثناء تحديث بيانات العامل' });
    }
};

exports.deleteWorker = (req, res) => {
    try {
        db.prepare('DELETE FROM workers WHERE id = ?').run(req.params.id);
        res.json({ message: 'تم حذف العامل بنجاح' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getWorkerSummary = (req, res) => {
    const workerId = req.params.id;
    const { month } = req.query; // YYYY-MM
    try {
        const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(workerId);
        if (!worker) return res.status(404).json({ error: 'العامل غير موجود' });

        let monthFilter = month ? month : new Date().toISOString().substring(0, 7);
        const startDate = `${monthFilter}-01`;
        const endDate = `${monthFilter}-31`;

        const withdrawals = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total_withdrawn 
            FROM worker_withdrawals 
            WHERE worker_id = ? AND date(withdrawal_date) BETWEEN date(?) AND date(?)
        `).get(workerId, startDate, endDate);

        const attendance = db.prepare(`
            SELECT 
                SUM(CASE WHEN status = 'حاضر' THEN 1 ELSE 0 END) as present_days,
                SUM(CASE WHEN status = 'غائب' THEN 1 ELSE 0 END) as absent_days
            FROM worker_attendance
            WHERE worker_id = ? AND date(date) BETWEEN date(?) AND date(?)
        `).get(workerId, startDate, endDate);

        const obRow = db.prepare("SELECT * FROM opening_balances WHERE entity_type = 'worker' AND entity_id = ?").get(workerId);
        const openingBalanceAmount = obRow ? obRow.amount : 0;
        const openingBalanceType = obRow ? obRow.balance_type : 'debit';
        // debit = worker owes company (sulaaf/advance), credit = company owes worker (unpaid salary/dues)
        const openingSigned = obRow ? (openingBalanceType === 'debit' ? -openingBalanceAmount : openingBalanceAmount) : 0;

        const totalWithdrawals = withdrawals.total_withdrawn;
        const monthlySalary = worker.monthly_salary;
        const netWorkerBalance = monthlySalary + openingSigned - totalWithdrawals;

        let salaryStatus = '';
        if (netWorkerBalance === 0) salaryStatus = 'الحساب متوازن';
        else if (netWorkerBalance < 0) salaryStatus = `تنبيه: المسحوبات/السلف تجاوزت المستحق بـ (${Math.abs(netWorkerBalance).toLocaleString()} ج.م)`;
        else salaryStatus = `صافي المستحق للعامل: ${netWorkerBalance.toLocaleString()} ج.م`;

        res.json({
            worker,
            opening_balance: obRow || null,
            financials: {
                monthly_salary: monthlySalary,
                opening_balance_amount: openingBalanceAmount,
                opening_balance_type: openingBalanceType,
                total_withdrawn: totalWithdrawals,
                remaining_salary: netWorkerBalance,
                status_message: salaryStatus
            },
            attendance: {
                present: attendance.present_days || 0,
                absent: attendance.absent_days || 0,
                total: (attendance.present_days || 0) + (attendance.absent_days || 0)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- Attendance ---
exports.getDailyAttendance = (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'التاريخ مطلوب' });

    try {
        // Get all active workers and left join with attendance for this date
        const attendanceList = db.prepare(`
            SELECT w.id as worker_id, w.name, w.job_title, a.status, a.notes, a.id as attendance_id
            FROM workers w
            LEFT JOIN worker_attendance a ON w.id = a.worker_id AND date(a.date) = date(?)
            WHERE w.status = 'active'
            ORDER BY w.name ASC
        `).all(date);
        res.json(attendanceList);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.saveBatchAttendance = (req, res) => {
    const { date, records } = req.body; // records: [{worker_id, status, notes}]
    try {
        const transaction = db.transaction((recs) => {
            const insertStmt = db.prepare(`
                INSERT INTO worker_attendance (worker_id, date, status, notes)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(worker_id, date) DO UPDATE SET status=excluded.status, notes=excluded.notes
            `);
            for (let rec of recs) {
                insertStmt.run(rec.worker_id, date, rec.status, rec.notes || '');
            }
        });
        transaction(records);
        res.json({ message: 'تم حفظ الحضور بنجاح' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getWorkerAttendance = (req, res) => {
    const { month } = req.query;
    try {
        let query = 'SELECT * FROM worker_attendance WHERE worker_id = ?';
        let params = [req.params.id];
        if (month) {
            query += ' AND date(date) BETWEEN date(?) AND date(?)';
            params.push(`${month}-01`, `${month}-31`);
        }
        query += ' ORDER BY date DESC';
        const list = db.prepare(query).all(...params);
        res.json(list);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- Withdrawals ---
exports.getWorkerWithdrawals = (req, res) => {
    const { month } = req.query;
    try {
        let query = 'SELECT * FROM worker_withdrawals WHERE worker_id = ?';
        let params = [req.params.id];
        if (month) {
            query += ' AND date(withdrawal_date) BETWEEN date(?) AND date(?)';
            params.push(`${month}-01`, `${month}-31`);
        }
        query += ' ORDER BY withdrawal_date DESC, created_at DESC';
        const w = db.prepare(query).all(...params);
        res.json(w);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createWithdrawal = (req, res) => {
    const { amount, withdrawal_type, withdrawal_date, description, notes } = req.body;
    try {
        const result = db.prepare(`
            INSERT INTO worker_withdrawals (worker_id, amount, withdrawal_type, withdrawal_date, description, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(req.params.id, amount, withdrawal_type || 'سلفة', withdrawal_date, description || '', notes || '');
        
        const wName = db.prepare('SELECT name FROM workers WHERE id = ?').get(req.params.id)?.name;
        treasuryController.recordTransaction({
            type: 'payment',
            party_type: 'worker',
            party_id: req.params.id,
            party_name: wName,
            amount: amount,
            payment_method: 'نقدي',
            description: description || `مسحوبات عامل - ${withdrawal_type}`,
            reference_type: 'WORKER_WITHDRAWAL',
            reference_id: result.lastInsertRowid,
            transaction_date: withdrawal_date
        });

        res.json({ message: 'تم تسجيل المسحوب بنجاح' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteWithdrawal = (req, res) => {
    try {
        db.prepare('DELETE FROM worker_withdrawals WHERE id = ?').run(req.params.id);
        res.json({ message: 'تم الحذف بنجاح' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// ----------------------------------------------------
// ADVANCED ATTENDANCE & LEAVES
// ----------------------------------------------------

exports.startWork = (req, res) => {
    const { id } = req.params;
    let { date, start_time, notes } = req.body;
    
    // Default to today and current time if not provided
    if (!date) {
        const d = new Date();
        date = d.toISOString().split('T')[0];
    }
    if (!start_time) {
        const d = new Date();
        start_time = d.toTimeString().split(' ')[0].substring(0,5); // HH:MM
    }

    try {
        const stmt = db.prepare(`
            INSERT INTO worker_attendance (worker_id, date, start_time, status, notes) 
            VALUES (?, ?, ?, 'حاضر', ?) 
            ON CONFLICT(worker_id, date) DO UPDATE SET 
            start_time = excluded.start_time,
            status = 'حاضر',
            notes = excluded.notes
        `);
        stmt.run(id, date, start_time, notes || null);
        res.json({ success: true, message: 'تم تسجيل الحضور' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الحضور' });
    }
};

exports.endWork = (req, res) => {
    const { id } = req.params;
    let { date, end_time } = req.body;
    
    if (!date) {
        const d = new Date();
        date = d.toISOString().split('T')[0];
    }
    if (!end_time) {
        const d = new Date();
        end_time = d.toTimeString().split(' ')[0].substring(0,5); // HH:MM
    }

    try {
        // Fetch existing start_time to calculate total_hours
        const existing = db.prepare('SELECT start_time FROM worker_attendance WHERE worker_id = ? AND date = ?').get(id, date);
        let total_hours = null;
        if (existing && existing.start_time) {
            const [sh, sm] = existing.start_time.split(':').map(Number);
            const [eh, em] = end_time.split(':').map(Number);
            let diff = (eh + em/60) - (sh + sm/60);
            if (diff < 0) diff += 24; // Cross midnight
            total_hours = parseFloat(diff.toFixed(2));
        }

        const stmt = db.prepare(`
            UPDATE worker_attendance 
            SET end_time = ?, total_hours = ? 
            WHERE worker_id = ? AND date = ?
        `);
        const result = stmt.run(end_time, total_hours, id, date);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'لم يتم العثور على سجل حضور لهذا اليوم للبدء منه' });
        }
        
        res.json({ success: true, total_hours, message: 'تم تسجيل الانصراف' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الانصراف' });
    }
};

exports.getWorkerAttendanceWithHours = (req, res) => {
    const { id } = req.params;
    try {
        const attendance = db.prepare('SELECT * FROM worker_attendance WHERE worker_id = ? ORDER BY date DESC').all(id);
        res.json(attendance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getWorkerLeaves = (req, res) => {
    const { id } = req.params;
    try {
        const leaves = db.prepare('SELECT * FROM worker_leaves WHERE worker_id = ? ORDER BY start_date DESC').all(id);
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createLeave = (req, res) => {
    const { id } = req.params;
    const { leave_type, start_date, end_date, reason, notes } = req.body;
    
    if (!leave_type || !start_date || !end_date) {
        return res.status(400).json({ error: 'نوع الإجازة وتاريخ البدء والانتهاء مطلوبين' });
    }
    
    try {
        // Calculate days
        const start = new Date(start_date);
        const end = new Date(end_date);
        const diffTime = Math.abs(end - start);
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
        
        if (days < 1) return res.status(400).json({ error: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء' });

        const stmt = db.prepare(`
            INSERT INTO worker_leaves (worker_id, leave_type, start_date, end_date, days, reason, notes) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(id, leave_type, start_date, end_date, days, reason || null, notes || null);
        
        // Optionally insert into attendance table as 'إجازة' for each day?
        // Let's do it for consistency in reports.
        const insertAtt = db.prepare(`
            INSERT INTO worker_attendance (worker_id, date, status, notes) 
            VALUES (?, ?, 'إجازة', ?) 
            ON CONFLICT(worker_id, date) DO UPDATE SET status = 'إجازة', notes = excluded.notes
        `);
        const addDays = (date, numDays) => {
            const result = new Date(date);
            result.setDate(result.getDate() + numDays);
            return result.toISOString().split('T')[0];
        };
        const transaction = db.transaction(() => {
            for(let i=0; i<days; i++) {
                const currentDay = addDays(start_date, i);
                insertAtt.run(id, currentDay, leave_type);
            }
        });
        transaction();

        res.json({ success: true, message: 'تم تسجيل الإجازة', days });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

exports.deleteLeave = (req, res) => {
    const { leaveId } = req.params;
    try {
        db.prepare('DELETE FROM worker_leaves WHERE id = ?').run(leaveId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getMonthlySummary = (req, res) => {
    const { id } = req.params;
    const { month, year } = req.query; // optional filtering
    try {
        let query = 'SELECT * FROM worker_attendance WHERE worker_id = ?';
        let params = [id];
        
        if (month && year) {
            query += " AND strftime('%m', date) = ? AND strftime('%Y', date) = ?";
            const m = String(month).padStart(2, '0');
            params.push(m, String(year));
        }
        
        const attendance = db.prepare(query).all(...params);
        
        let totalWorkingDays = attendance.length;
        let present = 0, absent = 0, leave = 0, holiday = 0, halfDay = 0;
        let totalHours = 0;
        
        attendance.forEach(a => {
            if (a.status === 'حاضر') present++;
            else if (a.status === 'غائب') absent++;
            else if (a.status === 'إجازة') leave++;
            else if (a.status === 'عطلة') holiday++;
            else if (a.status === 'نصف يوم') halfDay++;
            
            if (a.total_hours) totalHours += a.total_hours;
        });
        
        res.json({
            working_days: totalWorkingDays,
            present,
            absent,
            leave,
            holiday,
            half_day: halfDay,
            total_hours: totalHours,
            average_daily_hours: present > 0 ? (totalHours / present).toFixed(2) : 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


function normalizeDateStr(dStr) {
    if (!dStr) return new Date().toISOString().split('T')[0];
    const parts = dStr.split('T')[0].split('-');
    if (parts.length === 3) {
        const y = parts[0];
        const m = parts[1].padStart(2, '0');
        const d = parts[2].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return dStr;
}

exports.saveDailyAttendance = (req, res) => {
    const { id } = req.params;
    let { date, status, notes } = req.body;
    
    if (!date || !status) return res.status(400).json({ error: 'التاريخ والحالة مطلوبان' });
    date = normalizeDateStr(date);

    try {
        const stmt = db.prepare(`
            INSERT INTO worker_attendance (worker_id, date, status, notes) 
            VALUES (?, ?, ?, ?) 
            ON CONFLICT(worker_id, date) DO UPDATE SET 
            status = excluded.status,
            notes = excluded.notes
        `);
        stmt.run(id, date, status, notes || '');
        
        try {
            require('./auditLogger').logAction('مستخدم النظام', 'CREATE', 'العمال', 'WORKERS', 'attendance', 'تسجيل حضور يومي', null, { id, date, status });
        } catch(e) {}

        res.json({ message: 'تم حفظ الحضور بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteAttendance = (req, res) => {
    const { attendanceId } = req.params;
    try {
        db.prepare('DELETE FROM worker_attendance WHERE id = ?').run(attendanceId);
        res.json({ success: true, message: 'تم حذف سجل الحضور بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
