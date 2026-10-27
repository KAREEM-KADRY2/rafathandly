const db = require('../db');
const periodsController = require('./periodsController');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// Helper to calculate partner metrics from persisted data
function getPartnerMetrics(partner) {
    if (!partner) return null;
    const partnerId = partner.id;

    const registeredCapital = Number(partner.capital_contribution) || 0;

    const stats = db.prepare(`
        SELECT 
            COALESCE(SUM(CASE WHEN transaction_type = 'capital_contribution' AND (notes != 'إيداع رأس المال الافتتاحي في الخزينة' AND description NOT LIKE 'رأس مال مساهم به عند بدء الشراكة%') AND (status IS NULL OR status != 'cancelled') THEN amount ELSE 0 END), 0) as total_capital_contributions,
            COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal' AND (status IS NULL OR status != 'cancelled') THEN amount ELSE 0 END), 0) as total_withdrawals,
            COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal_return' AND (status IS NULL OR status != 'cancelled') THEN amount ELSE 0 END), 0) as total_returned,
            COALESCE(SUM(CASE WHEN transaction_type = 'payment' AND (status IS NULL OR status != 'cancelled') THEN amount ELSE 0 END), 0) as total_payments,
            COALESCE(SUM(CASE WHEN transaction_type = 'profit_distribution' AND (status IS NULL OR status != 'cancelled') THEN amount ELSE 0 END), 0) as total_profit_distributions,
            COUNT(CASE WHEN transaction_type = 'withdrawal' AND (status IS NULL OR status != 'cancelled') THEN 1 END) as withdrawals_count,
            COUNT(CASE WHEN (status IS NULL OR status != 'cancelled') THEN 1 END) as total_transactions_count,
            MAX(CASE WHEN transaction_type = 'withdrawal' AND (status IS NULL OR status != 'cancelled') THEN transaction_date END) as last_withdrawal_date,
            MAX(CASE WHEN (status IS NULL OR status != 'cancelled') THEN transaction_date END) as last_transaction_date
        FROM partner_transactions
        WHERE partner_id = ?
    `).get(partnerId);

    const totalCapital = registeredCapital + (stats.total_capital_contributions || 0);
    const totalWithdrawals = stats.total_withdrawals || 0;
    const totalReturned = stats.total_returned || 0;
    const netWithdrawals = Math.max(0, totalWithdrawals - totalReturned);
    const totalDraws = netWithdrawals + (stats.total_payments || 0) + (stats.total_profit_distributions || 0);
    
    // User requirement: Partner withdrawals must NEVER be deducted from capital!
    // Capital stays 100% intact and preserved.
    const currentBalance = totalCapital;

    return {
        ...partner,
        registered_capital: registeredCapital,
        total_capital_contributions: stats.total_capital_contributions || 0,
        total_capital: totalCapital,
        total_withdrawals: totalWithdrawals,
        total_returned: totalReturned,
        net_withdrawals: netWithdrawals,
        total_payments: stats.total_payments || 0,
        total_profit_distributions: stats.total_profit_distributions || 0,
        total_draws: totalDraws,
        current_balance: currentBalance,
        net_drawings: totalDraws,
        withdrawals_count: stats.withdrawals_count || 0,
        total_transactions_count: stats.total_transactions_count || 0,
        last_withdrawal_date: stats.last_withdrawal_date || null,
        last_transaction_date: stats.last_transaction_date || null
    };
}

// 1. Get all partners with summary
exports.getPartners = (req, res) => {
    try {
        const { status = 'all', search } = req.query;

        let query = 'SELECT * FROM partners';
        const conditions = [];
        const params = [];

        if (status === 'active') {
            conditions.push('is_active = 1');
        } else if (status === 'archived') {
            conditions.push('is_active = 0');
        }

        if (search && search.trim()) {
            conditions.push('(name LIKE ? OR phone LIKE ? OR notes LIKE ?)');
            const s = `%${search.trim()}%`;
            params.push(s, s, s);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY is_active DESC, share_percentage DESC, id ASC';

        const rawPartners = db.prepare(query).all(...params);
        const partners = rawPartners.map(p => getPartnerMetrics(p));

        // System-wide calculations (based on active partners)
        const allActive = db.prepare('SELECT * FROM partners WHERE is_active = 1').all().map(p => getPartnerMetrics(p));
        const totalPercentage = allActive.reduce((sum, p) => sum + (Number(p.share_percentage) || 0), 0);
        const totalCapital = allActive.reduce((sum, p) => sum + (Number(p.total_capital) || 0), 0);
        const totalWithdrawals = allActive.reduce((sum, p) => sum + (Number(p.total_withdrawals) || 0), 0);
        const totalReturned = allActive.reduce((sum, p) => sum + (Number(p.total_returned) || 0), 0);
        const netWithdrawals = allActive.reduce((sum, p) => sum + (Number(p.net_withdrawals) || 0), 0);
        const totalPayments = allActive.reduce((sum, p) => sum + (Number(p.total_payments) || 0), 0);
        const totalProfitDistributions = allActive.reduce((sum, p) => sum + (Number(p.total_profit_distributions) || 0), 0);
        const totalBalance = allActive.reduce((sum, p) => sum + (Number(p.current_balance) || 0), 0);

        res.json({
            partners,
            summary: {
                total_partners: allActive.length,
                archived_partners: db.prepare('SELECT COUNT(*) as count FROM partners WHERE is_active = 0').get().count,
                total_percentage: Math.round(totalPercentage * 100) / 100,
                is_percentage_valid: Math.round(totalPercentage * 100) / 100 === 100,
                percentage_diff: Math.round((100 - totalPercentage) * 100) / 100,
                total_capital: totalCapital,
                total_withdrawals: totalWithdrawals,
                total_returned: totalReturned,
                net_withdrawals: netWithdrawals,
                total_payments: totalPayments,
                total_profit_distributions: totalProfitDistributions,
                total_balance: totalBalance
            }
        });
    } catch (error) {
        console.error('Error fetching partners:', error);
        res.status(500).json({ error: error.message });
    }
};

// 2. Get Dashboard Data
exports.getDashboard = (req, res) => {
    try {
        const activePartners = db.prepare('SELECT * FROM partners WHERE is_active = 1').all().map(p => getPartnerMetrics(p));
        const archivedCount = db.prepare('SELECT COUNT(*) as count FROM partners WHERE is_active = 0').get().count;

        const totalPercentage = activePartners.reduce((sum, p) => sum + (Number(p.share_percentage) || 0), 0);
        const totalCapital = activePartners.reduce((sum, p) => sum + (Number(p.total_capital) || 0), 0);
        const totalWithdrawals = activePartners.reduce((sum, p) => sum + (Number(p.total_withdrawals) || 0), 0);
        const totalReturned = activePartners.reduce((sum, p) => sum + (Number(p.total_returned) || 0), 0);
        const netWithdrawals = activePartners.reduce((sum, p) => sum + (Number(p.net_withdrawals) || 0), 0);
        const totalPayments = activePartners.reduce((sum, p) => sum + (Number(p.total_payments) || 0), 0);
        const totalProfitDistributions = activePartners.reduce((sum, p) => sum + (Number(p.total_profit_distributions) || 0), 0);
        const totalBalance = activePartners.reduce((sum, p) => sum + (Number(p.current_balance) || 0), 0);

        res.json({
            total_partners: activePartners.length,
            archived_partners: archivedCount,
            total_percentage: Math.round(totalPercentage * 100) / 100,
            is_percentage_valid: Math.round(totalPercentage * 100) / 100 === 100,
            percentage_diff: Math.round((100 - totalPercentage) * 100) / 100,
            total_capital: totalCapital,
            total_withdrawals: totalWithdrawals,
            total_returned: totalReturned,
            net_withdrawals: netWithdrawals,
            total_payments: totalPayments,
            total_profit_distributions: totalProfitDistributions,
            total_balance: totalBalance,
            partners: activePartners
        });
    } catch (error) {
        console.error('Error fetching partner dashboard:', error);
        res.status(500).json({ error: error.message });
    }
};

// 3. Get single partner by ID
exports.getPartnerById = (req, res) => {
    try {
        const { id } = req.params;
        const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
        if (!partner) return res.status(404).json({ error: 'الشريك غير موجود' });

        const enriched = getPartnerMetrics(partner);
        res.json(enriched);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 4. Create partner
exports.createPartner = (req, res) => {
    try {
        const {
            name,
            share_percentage,
            capital_contribution = 0,
            start_date,
            phone,
            notes,
            initial_account_id
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'اسم الشريك مطلوب' });
        }

        const percentage = Number(share_percentage);
        if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
            return res.status(400).json({ error: 'نسبة الشراكة يجب أن تكون أكبر من 0 وأقل من أو تساوي 100%' });
        }

        const numCapital = Math.max(0, Number(capital_contribution) || 0);
        const startDate = start_date || new Date().toISOString().substring(0, 10);

        let partnerId;
        db.transaction(() => {
            const stmt = db.prepare(`
                INSERT INTO partners (name, share_percentage, capital_contribution, start_date, phone, notes, is_active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            `);
            const result = stmt.run(name.trim(), percentage, numCapital, startDate, phone ? phone.trim() : null, notes ? notes.trim() : null);
            partnerId = result.lastInsertRowid;

            // If an initial financial account was selected to deposit capital
            if (initial_account_id && numCapital > 0) {
                const acc = db.prepare('SELECT id, name FROM financial_accounts WHERE id = ?').get(initial_account_id);
                if (acc) {
                    const activePeriodId = periodsController.getActivePeriodId();
                    const desc = `رأس مال مساهم به عند بدء الشراكة - ${name.trim()}`;
                    
                    const ttRes = db.prepare(`
                        INSERT INTO treasury_transactions 
                        (account_id, type, amount, date, description, related_entity_type, related_entity_id, user, period_id, reference_type, reference_id)
                        VALUES (?, 'IN', ?, ?, ?, 'partner', ?, 'مستخدم النظام', ?, 'partner_transaction', NULL)
                    `).run(acc.id, numCapital, startDate, desc, partnerId, activePeriodId);
                    
                    const ttId = ttRes.lastInsertRowid;
                    db.prepare('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?').run(numCapital, acc.id);

                    const ptRes = db.prepare(`
                        INSERT INTO partner_transactions (partner_id, transaction_type, amount, transaction_date, payment_method, account_id, treasury_tx_id, description, notes)
                        VALUES (?, 'capital_contribution', ?, ?, ?, ?, ?, ?, 'إيداع رأس المال الافتتاحي في الخزينة')
                    `).run(partnerId, numCapital, startDate, acc.name, acc.id, ttId, desc);

                    db.prepare('UPDATE treasury_transactions SET reference_id = ? WHERE id = ?').run(ptRes.lastInsertRowid, ttId);
                }
            }
        })();

        const createdPartner = getPartnerMetrics(db.prepare('SELECT * FROM partners WHERE id = ?').get(partnerId));
        res.status(201).json(createdPartner);
    } catch (error) {
        console.error('Error creating partner:', error);
        res.status(500).json({ error: error.message });
    }
};

// 5. Update partner
exports.updatePartner = (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            share_percentage,
            capital_contribution = 0,
            start_date,
            phone,
            notes
        } = req.body;

        const existing = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
        if (!existing) return res.status(404).json({ error: 'الشريك غير موجود' });

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'اسم الشريك مطلوب' });
        }

        const percentage = Number(share_percentage);
        if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
            return res.status(400).json({ error: 'نسبة الشراكة يجب أن تكون أكبر من 0 وأقل من أو تساوي 100%' });
        }

        const numCapital = Math.max(0, Number(capital_contribution) || 0);

        db.prepare(`
            UPDATE partners
            SET name = ?, share_percentage = ?, capital_contribution = ?, start_date = ?, phone = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            name.trim(),
            percentage,
            numCapital,
            start_date || existing.start_date,
            phone ? phone.trim() : null,
            notes ? notes.trim() : null,
            id
        );

        const updated = getPartnerMetrics(db.prepare('SELECT * FROM partners WHERE id = ?').get(id));
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 6. Archive partner
exports.archivePartner = (req, res) => {
    try {
        const { id } = req.params;
        const existing = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
        if (!existing) return res.status(404).json({ error: 'الشريك غير موجود' });

        db.prepare('UPDATE partners SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
        res.json({ success: true, message: 'تم أرشفة الشريك مع الحفاظ على كامل السجلات المالية والمعاملات.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 7. Unarchive partner
exports.unarchivePartner = (req, res) => {
    try {
        const { id } = req.params;
        const existing = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
        if (!existing) return res.status(404).json({ error: 'الشريك غير موجود' });

        db.prepare('UPDATE partners SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
        res.json({ success: true, message: 'تم استعادة تفعيل الشريك بنجاح.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 8. Delete partner (only allowed if NO transactions exist)
exports.deletePartner = (req, res) => {
    try {
        const { id } = req.params;
        const existing = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
        if (!existing) return res.status(404).json({ error: 'الشريك غير موجود' });

        const txCount = db.prepare('SELECT COUNT(*) as count FROM partner_transactions WHERE partner_id = ?').get(id).count;
        if (txCount > 0) {
            return res.status(400).json({
                error: `لا يمكن حذف الشريك لوجود (${txCount}) حركة مالية ومسحوبات مسجلة باسمه. يمكنك أرشفة الشريك بدلاً من حذفه للحفاظ على السجل المالي والمحاسبي.`
            });
        }

        db.prepare('DELETE FROM partners WHERE id = ?').run(id);
        res.json({ success: true, message: 'تم حذف الشريك بنجاح.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Helper for date filter calculation
function getDateBounds(filter, customStart, customEnd) {
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

    if (filter === 'today') {
        return { start: todayStr, end: todayStr };
    }
    if (filter === 'week') {
        const d = new Date(now);
        const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
        // Assume Saturday is start of week in Egypt (or 7 days ago)
        const diff = d.getDate() - 6;
        const startOfWeek = new Date(d.setDate(diff));
        return { 
            start: startOfWeek.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }), 
            end: todayStr 
        };
    }
    if (filter === 'month') {
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        return { start: `${y}-${m}-01`, end: todayStr };
    }
    if (filter === 'year') {
        const y = now.getFullYear();
        return { start: `${y}-01-01`, end: todayStr };
    }
    if (filter === 'custom' || (customStart && customEnd)) {
        return { start: customStart || null, end: customEnd || null };
    }
    return { start: null, end: null };
}

// 9. Get partner transactions
exports.getPartnerTransactions = (req, res) => {
    try {
        const { id } = req.params;
        const { filter = 'all', startDate, endDate } = req.query;

        const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
        if (!partner) return res.status(404).json({ error: 'الشريك غير موجود' });

        const bounds = getDateBounds(filter, startDate, endDate);
        let query = `
            SELECT pt.*, fa.name as account_name
            FROM partner_transactions pt
            LEFT JOIN financial_accounts fa ON pt.account_id = fa.id
            WHERE pt.partner_id = ?
        `;
        const params = [id];

        if (bounds.start) {
            query += ' AND date(pt.transaction_date) >= date(?)';
            params.push(bounds.start);
        }
        if (bounds.end) {
            query += ' AND date(pt.transaction_date) <= date(?)';
            params.push(bounds.end);
        }

        query += ' ORDER BY pt.transaction_date DESC, pt.id DESC';
        const rawTransactions = db.prepare(query).all(...params);

        // Enrich transactions with linked returns and computed statuses
        const enrichedTransactions = rawTransactions.map(t => {
            const txStatus = t.status || 'active';

            if (t.transaction_type === 'withdrawal') {
                const linkedReturns = db.prepare(`
                    SELECT pt2.*, fa2.name as account_name
                    FROM partner_transactions pt2
                    LEFT JOIN financial_accounts fa2 ON pt2.account_id = fa2.id
                    WHERE pt2.parent_transaction_id = ? AND (pt2.status IS NULL OR pt2.status != 'cancelled')
                    ORDER BY pt2.transaction_date ASC, pt2.id ASC
                `).all(t.id);

                const returnedAmount = linkedReturns.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
                const remainingAmount = Math.max(0, Number(t.amount) - returnedAmount);

                let computedStatus = txStatus;
                if (txStatus !== 'cancelled') {
                    if (returnedAmount >= Number(t.amount)) {
                        computedStatus = 'completed_return';
                    } else if (returnedAmount > 0) {
                        computedStatus = 'partial_return';
                    } else {
                        computedStatus = 'active';
                    }
                }

                return {
                    ...t,
                    status: txStatus,
                    computed_status: computedStatus,
                    returned_amount: returnedAmount,
                    remaining_amount: remainingAmount,
                    linked_returns: linkedReturns
                };
            } else if (t.transaction_type === 'withdrawal_return') {
                let parentWithdrawal = null;
                if (t.parent_transaction_id) {
                    parentWithdrawal = db.prepare(`
                        SELECT id, amount, transaction_date, description, status
                        FROM partner_transactions
                        WHERE id = ?
                    `).get(t.parent_transaction_id);
                }

                return {
                    ...t,
                    status: txStatus,
                    computed_status: txStatus,
                    parent_withdrawal: parentWithdrawal
                };
            }

            return {
                ...t,
                status: txStatus,
                computed_status: txStatus
            };
        });

        // Calculate period metrics (excluding cancelled)
        let periodWithdrawals = 0;
        let periodReturned = 0;
        let periodPayments = 0;
        let periodCapital = 0;
        let periodProfitDistributions = 0;

        for (const t of enrichedTransactions) {
            if (t.status === 'cancelled') continue;
            if (t.transaction_type === 'withdrawal') periodWithdrawals += t.amount;
            else if (t.transaction_type === 'withdrawal_return') periodReturned += t.amount;
            else if (t.transaction_type === 'payment') periodPayments += t.amount;
            else if (t.transaction_type === 'capital_contribution') periodCapital += t.amount;
            else if (t.transaction_type === 'profit_distribution') periodProfitDistributions += t.amount;
        }

        const periodNetWithdrawals = Math.max(0, periodWithdrawals - periodReturned);
        const periodNetMovement = (periodCapital + periodReturned) - (periodWithdrawals + periodPayments + periodProfitDistributions);
        const enrichedPartner = getPartnerMetrics(partner);

        res.json({
            partner: enrichedPartner,
            filterApplied: { filter, start: bounds.start, end: bounds.end },
            transactions: enrichedTransactions,
            periodSummary: {
                total_withdrawals: periodWithdrawals,
                total_returned: periodReturned,
                net_withdrawals: periodNetWithdrawals,
                total_payments: periodPayments,
                total_capital: periodCapital,
                total_profit_distributions: periodProfitDistributions,
                net_movement: periodNetMovement,
                count: enrichedTransactions.filter(t => t.status !== 'cancelled').length
            }
        });
    } catch (error) {
        console.error('Error fetching partner transactions:', error);
        res.status(500).json({ error: error.message });
    }
};

// 10. Record partner withdrawal / payment / capital contribution / profit distribution
exports.createTransaction = (req, res) => {
    try {
        const partnerId = req.params.id || req.body.partner_id;
        const {
            amount,
            transaction_type,
            transaction_date,
            payment_method = 'نقدي (كاش)',
            account_id,
            description,
            reference,
            notes
        } = req.body;

        const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(partnerId);
        if (!partner) return res.status(404).json({ error: 'الشريك غير موجود' });

        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) {
            return res.status(400).json({ error: 'المبلغ يجب أن يكون أكبر من الصفر' });
        }

        const allowedTypes = ['withdrawal', 'payment', 'capital_contribution', 'profit_distribution'];
        if (!allowedTypes.includes(transaction_type)) {
            return res.status(400).json({ error: 'نوع العملية غير صالح. يجب اختيار سحب شخصي، أو دفعة، أو مساهمة رأس مال، أو توزيع أرباح.' });
        }

        const txDate = transaction_date || new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
        const typeLabels = {
            'withdrawal': 'سحب شخصي للشريك',
            'payment': 'دفعة نقدية للشريك',
            'capital_contribution': 'مساهمة رأس مال من الشريك',
            'profit_distribution': 'توزيع أرباح للشريك'
        };

        const finalDesc = description && description.trim() 
            ? description.trim() 
            : `${typeLabels[transaction_type]} - ${partner.name}`;

        let newTxId;

        db.transaction(() => {
            let ttId = null;

            // If linked to treasury (actual cashbox or bank movement)
            if (account_id && Number(account_id) > 0) {
                const acc = db.prepare('SELECT id, name FROM financial_accounts WHERE id = ?').get(account_id);
                if (!acc) throw new Error('الحساب المالي أو الخزينة غير موجودة');

                const ttType = transaction_type === 'capital_contribution' ? 'IN' : 'OUT';
                const activePeriodId = periodsController.getActivePeriodId();

                const ttRes = db.prepare(`
                    INSERT INTO treasury_transactions
                    (account_id, type, amount, date, description, related_entity_type, related_entity_id, user, period_id, reference_type, reference_id)
                    VALUES (?, ?, ?, ?, ?, 'partner', ?, 'مستخدم النظام', ?, 'partner_transaction', NULL)
                `).run(acc.id, ttType, numAmount, txDate, finalDesc, partnerId, activePeriodId);

                ttId = ttRes.lastInsertRowid;

                if (ttType === 'IN') {
                    db.prepare('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?').run(numAmount, acc.id);
                } else {
                    db.prepare('UPDATE financial_accounts SET balance = balance - ? WHERE id = ?').run(numAmount, acc.id);
                }
            }

            const ptRes = db.prepare(`
                INSERT INTO partner_transactions
                (partner_id, transaction_type, amount, transaction_date, payment_method, account_id, treasury_tx_id, description, reference, notes, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            `).run(
                partnerId,
                transaction_type,
                numAmount,
                txDate,
                payment_method,
                account_id && Number(account_id) > 0 ? Number(account_id) : null,
                ttId,
                finalDesc,
                reference ? reference.trim() : null,
                notes ? notes.trim() : null
            );

            newTxId = ptRes.lastInsertRowid;

            if (ttId) {
                db.prepare('UPDATE treasury_transactions SET reference_id = ? WHERE id = ?').run(newTxId, ttId);
            }
        })();

        const createdTx = db.prepare(`
            SELECT pt.*, fa.name as account_name
            FROM partner_transactions pt
            LEFT JOIN financial_accounts fa ON pt.account_id = fa.id
            WHERE pt.id = ?
        `).get(newTxId);

        res.status(201).json({
            success: true,
            message: 'تم تسجيل الحركة بنجاح وتحديث كافة الأرصدة المرتبطة.',
            transaction: createdTx
        });
    } catch (error) {
        console.error('Error creating partner transaction:', error);
        res.status(500).json({ error: error.message });
    }
};

// 10.B Record a return linked to an original withdrawal
exports.recordReturn = (req, res) => {
    try {
        const txId = req.params.txId;
        const {
            amount,
            transaction_date,
            payment_method = 'نقدي (كاش)',
            account_id,
            description,
            reference,
            notes
        } = req.body;

        const parentTx = db.prepare('SELECT * FROM partner_transactions WHERE id = ?').get(txId);
        if (!parentTx) {
            return res.status(404).json({ error: 'حركة السحب الأصلية غير موجودة' });
        }

        if (parentTx.transaction_type !== 'withdrawal') {
            return res.status(400).json({ error: 'لا يمكن تسجيل رد إلا على حركة من نوع سحب شخصي' });
        }

        if (parentTx.status === 'cancelled') {
            return res.status(400).json({ error: 'حركة السحب الأصلية ملغاة، لا يمكن تسجيل رد عليها' });
        }

        const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(parentTx.partner_id);
        if (!partner) return res.status(404).json({ error: 'الشريك غير موجود' });

        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) {
            return res.status(400).json({ error: 'المبلغ المرتجع يجب أن يكون أكبر من الصفر' });
        }

        // Calculate current unreturned balance
        const returnsSum = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM partner_transactions
            WHERE parent_transaction_id = ? AND (status IS NULL OR status != 'cancelled')
        `).get(txId).total || 0;

        const remainingBalance = Math.round((parentTx.amount - returnsSum) * 100) / 100;
        if (numAmount > remainingBalance) {
            return res.status(400).json({
                error: `المبلغ المرتجع (${numAmount.toLocaleString()} ج.م) يتجاوز الرصيد المتبقي من السحب (${remainingBalance.toLocaleString()} ج.م)`
            });
        }

        const txDate = transaction_date || new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
        const finalDesc = description && description.trim()
            ? description.trim()
            : `رد مبلغ مسحوبات للشريك - ${partner.name} (مرتبط بالسحب #${parentTx.id})`;

        let newReturnTxId;

        db.transaction(() => {
            let ttId = null;

            // Partner returning money to company treasury -> money comes IN
            if (account_id && Number(account_id) > 0) {
                const acc = db.prepare('SELECT id, name FROM financial_accounts WHERE id = ?').get(account_id);
                if (!acc) throw new Error('الحساب المالي أو الخزينة غير موجودة');

                const activePeriodId = periodsController.getActivePeriodId();

                const ttRes = db.prepare(`
                    INSERT INTO treasury_transactions
                    (account_id, type, amount, date, description, related_entity_type, related_entity_id, user, period_id, reference_type, reference_id)
                    VALUES (?, 'IN', ?, ?, ?, 'partner', ?, 'مستخدم النظام', ?, 'partner_transaction', NULL)
                `).run(acc.id, numAmount, txDate, finalDesc, partner.id, activePeriodId);

                ttId = ttRes.lastInsertRowid;

                db.prepare('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?').run(numAmount, acc.id);
            }

            const ptRes = db.prepare(`
                INSERT INTO partner_transactions
                (partner_id, transaction_type, amount, transaction_date, payment_method, account_id, treasury_tx_id, description, reference, notes, parent_transaction_id, status)
                VALUES (?, 'withdrawal_return', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            `).run(
                partner.id,
                numAmount,
                txDate,
                payment_method,
                account_id && Number(account_id) > 0 ? Number(account_id) : null,
                ttId,
                finalDesc,
                reference ? reference.trim() : null,
                notes ? notes.trim() : null,
                parentTx.id
            );

            newReturnTxId = ptRes.lastInsertRowid;

            if (ttId) {
                db.prepare('UPDATE treasury_transactions SET reference_id = ? WHERE id = ?').run(newReturnTxId, ttId);
            }
        })();

        const createdReturnTx = db.prepare(`
            SELECT pt.*, fa.name as account_name
            FROM partner_transactions pt
            LEFT JOIN financial_accounts fa ON pt.account_id = fa.id
            WHERE pt.id = ?
        `).get(newReturnTxId);

        res.status(201).json({
            success: true,
            message: 'تم تسجيل رد المبلغ بنجاح وتوريده إلى الخزينة وتحديث حساب الشريك.',
            transaction: createdReturnTx
        });
    } catch (error) {
        console.error('Error recording partner return:', error);
        res.status(500).json({ error: error.message });
    }
};

// 11. Update partner transaction
exports.updateTransaction = (req, res) => {
    try {
        const { txId } = req.params;
        const {
            amount,
            transaction_type,
            transaction_date,
            payment_method = 'نقدي (كاش)',
            account_id,
            description,
            reference,
            notes
        } = req.body;

        const oldTx = db.prepare('SELECT * FROM partner_transactions WHERE id = ?').get(txId);
        if (!oldTx) return res.status(404).json({ error: 'الحركة غير موجودة' });

        if (oldTx.status === 'cancelled') {
            return res.status(400).json({ error: 'لا يمكن تعديل حركة ملغاة' });
        }

        const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(oldTx.partner_id);
        if (!partner) return res.status(404).json({ error: 'الشريك غير موجود' });

        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) {
            return res.status(400).json({ error: 'المبلغ يجب أن يكون أكبر من الصفر' });
        }

        const effectiveType = transaction_type || oldTx.transaction_type;
        const allowedTypes = ['withdrawal', 'payment', 'capital_contribution', 'profit_distribution', 'withdrawal_return'];
        if (!allowedTypes.includes(effectiveType)) {
            return res.status(400).json({ error: 'نوع العملية غير صالح' });
        }

        // If it was a withdrawal:
        if (oldTx.transaction_type === 'withdrawal') {
            const returnsSum = db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM partner_transactions
                WHERE parent_transaction_id = ? AND (status IS NULL OR status != 'cancelled')
            `).get(txId).total || 0;

            if (returnsSum > 0 && effectiveType !== 'withdrawal') {
                return res.status(400).json({
                    error: 'لا يمكن تغيير نوع حركة سحب مسجل عليها مبالغ مرتجعة بالفعل'
                });
            }

            if (numAmount < returnsSum) {
                return res.status(400).json({
                    error: `لا يمكن تقليل مبلغ السحب إلى (${numAmount.toLocaleString()} ج.م) لأنه أقل من إجمالي المبالغ المردودة المرتبطة به (${returnsSum.toLocaleString()} ج.م)`
                });
            }
        }

        // If it was or is a withdrawal_return:
        if (oldTx.transaction_type === 'withdrawal_return' || effectiveType === 'withdrawal_return') {
            if (oldTx.parent_transaction_id) {
                const parentWithdrawal = db.prepare('SELECT * FROM partner_transactions WHERE id = ?').get(oldTx.parent_transaction_id);
                if (parentWithdrawal) {
                    const otherReturnsSum = db.prepare(`
                        SELECT COALESCE(SUM(amount), 0) as total
                        FROM partner_transactions
                        WHERE parent_transaction_id = ? AND id != ? AND (status IS NULL OR status != 'cancelled')
                    `).get(oldTx.parent_transaction_id, txId).total || 0;

                    if (otherReturnsSum + numAmount > parentWithdrawal.amount) {
                        const maxAllowed = Math.max(0, parentWithdrawal.amount - otherReturnsSum);
                        return res.status(400).json({
                            error: `المبلغ المرتجع الجديد (${numAmount.toLocaleString()} ج.م) يتجاوز أصل حركة السحب. الحد الأقصى المتاح للتعديل هو (${maxAllowed.toLocaleString()} ج.م)`
                        });
                    }
                }
            }
        }

        const txDate = transaction_date || oldTx.transaction_date;
        const typeLabels = {
            'withdrawal': 'سحب شخصي للشريك',
            'payment': 'دفعة نقدية للشريك',
            'capital_contribution': 'مساهمة رأس مال من الشريك',
            'profit_distribution': 'توزيع أرباح للشريك',
            'withdrawal_return': 'رد مبلغ مسحوبات للشريك'
        };
        const finalDesc = description && description.trim() 
            ? description.trim() 
            : `${typeLabels[effectiveType]} - ${partner.name}`;

        db.transaction(() => {
            // 1. Revert previous treasury movement if existed
            if (oldTx.treasury_tx_id) {
                const oldTt = db.prepare('SELECT * FROM treasury_transactions WHERE id = ?').get(oldTx.treasury_tx_id);
                if (oldTt) {
                    if (oldTt.type === 'IN') {
                        db.prepare('UPDATE financial_accounts SET balance = balance - ? WHERE id = ?').run(oldTt.amount, oldTt.account_id);
                    } else if (oldTt.type === 'OUT') {
                        db.prepare('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?').run(oldTt.amount, oldTt.account_id);
                    }
                    db.prepare('DELETE FROM treasury_transactions WHERE id = ?').run(oldTx.treasury_tx_id);
                }
            }

            // 2. Apply new treasury movement if account selected
            let newTtId = null;
            if (account_id && Number(account_id) > 0) {
                const acc = db.prepare('SELECT id, name FROM financial_accounts WHERE id = ?').get(account_id);
                if (!acc) throw new Error('الحساب المالي أو الخزينة غير موجودة');

                // 'IN' for capital_contribution and withdrawal_return; 'OUT' for withdrawal, payment, profit_distribution
                const ttType = (effectiveType === 'capital_contribution' || effectiveType === 'withdrawal_return') ? 'IN' : 'OUT';
                const activePeriodId = periodsController.getActivePeriodId();

                const ttRes = db.prepare(`
                    INSERT INTO treasury_transactions
                    (account_id, type, amount, date, description, related_entity_type, related_entity_id, user, period_id, reference_type, reference_id)
                    VALUES (?, ?, ?, ?, ?, 'partner', ?, 'مستخدم النظام', ?, 'partner_transaction', ?)
                `).run(acc.id, ttType, numAmount, txDate, finalDesc, partner.id, activePeriodId, txId);

                newTtId = ttRes.lastInsertRowid;

                if (ttType === 'IN') {
                    db.prepare('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?').run(numAmount, acc.id);
                } else {
                    db.prepare('UPDATE financial_accounts SET balance = balance - ? WHERE id = ?').run(numAmount, acc.id);
                }
            }

            // 3. Update partner_transactions row
            db.prepare(`
                UPDATE partner_transactions
                SET transaction_type = ?, amount = ?, transaction_date = ?, payment_method = ?,
                    account_id = ?, treasury_tx_id = ?, description = ?, reference = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                effectiveType,
                numAmount,
                txDate,
                payment_method,
                account_id && Number(account_id) > 0 ? Number(account_id) : null,
                newTtId,
                finalDesc,
                reference ? reference.trim() : null,
                notes ? notes.trim() : null,
                txId
            );
        })();

        const updatedTx = db.prepare(`
            SELECT pt.*, fa.name as account_name
            FROM partner_transactions pt
            LEFT JOIN financial_accounts fa ON pt.account_id = fa.id
            WHERE pt.id = ?
        `).get(txId);

        res.json({
            success: true,
            message: 'تم تعديل الحركة وتحديث الخزينة وحساب الشريك بنجاح.',
            transaction: updatedTx
        });
    } catch (error) {
        console.error('Error updating partner transaction:', error);
        res.status(500).json({ error: error.message });
    }
};

// 12. Delete / Cancel partner transaction
exports.deleteTransaction = (req, res) => {
    try {
        const { txId } = req.params;
        const { reason } = req.body || {};

        const tx = db.prepare('SELECT * FROM partner_transactions WHERE id = ?').get(txId);
        if (!tx) return res.status(404).json({ error: 'الحركة غير موجودة' });

        if (tx.status === 'cancelled') {
            return res.status(400).json({ error: 'الحركة ملغاة بالفعل' });
        }

        // Check if this is a withdrawal with active linked returns!
        if (tx.transaction_type === 'withdrawal') {
            const activeReturnsCount = db.prepare(`
                SELECT COUNT(*) as count 
                FROM partner_transactions 
                WHERE parent_transaction_id = ? AND (status IS NULL OR status != 'cancelled')
            `).get(txId).count;

            if (activeReturnsCount > 0) {
                return res.status(400).json({
                    error: `لا يمكن حذف أو إلغاء حركة السحب هذه لوجود (${activeReturnsCount}) حركة رد مبالغ مرتبطة بها. يجب إلغاء حركات الرد أولاً لتفادي تضارب الحسابات.`
                });
            }
        }

        db.transaction(() => {
            // 1. Revert treasury movement cleanly if it existed
            if (tx.treasury_tx_id) {
                const tt = db.prepare('SELECT * FROM treasury_transactions WHERE id = ?').get(tx.treasury_tx_id);
                if (tt) {
                    if (tt.type === 'IN') {
                        db.prepare('UPDATE financial_accounts SET balance = balance - ? WHERE id = ?').run(tt.amount, tt.account_id);
                    } else if (tt.type === 'OUT') {
                        db.prepare('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?').run(tt.amount, tt.account_id);
                    }
                    db.prepare('DELETE FROM treasury_transactions WHERE id = ?').run(tx.treasury_tx_id);
                }
            }

            // 2. Safe cancellation: preserve audit history instead of hard deleting
            const cancelReason = reason && reason.trim() ? reason.trim() : 'إلغاء يدوي من قبل المستخدم';
            db.prepare(`
                UPDATE partner_transactions
                SET status = 'cancelled',
                    cancel_reason = ?,
                    cancelled_at = CURRENT_TIMESTAMP,
                    cancelled_by = 'مستخدم النظام',
                    treasury_tx_id = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(cancelReason, txId);
        })();

        res.json({
            success: true,
            message: 'تم إلغاء الحركة بنجاح وعكس كافة تأثيراتها المالية على الخزينة وحساب الشريك مع حفظ سجل الأمان.'
        });
    } catch (error) {
        console.error('Error cancelling partner transaction:', error);
        res.status(500).json({ error: error.message });
    }
};

// 13. Get Partner Account Statement Data
exports.getPartnerStatement = (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
        if (!partner) return res.status(404).json({ error: 'الشريك غير موجود' });

        const registeredCapital = Number(partner.capital_contribution) || 0;

        const initialDepositRow = db.prepare(`
            SELECT * FROM partner_transactions
            WHERE partner_id = ? AND transaction_type = 'capital_contribution' 
              AND (notes = 'إيداع رأس المال الافتتاحي في الخزينة' OR description LIKE 'رأس مال مساهم به عند بدء الشراكة%')
              AND (status IS NULL OR status != 'cancelled')
        `).get(id);
        const initialDepositAmount = initialDepositRow ? (Number(initialDepositRow.amount) || 0) : 0;

        let query = `
            SELECT pt.*, fa.name as account_name
            FROM partner_transactions pt
            LEFT JOIN financial_accounts fa ON pt.account_id = fa.id
            WHERE pt.partner_id = ? AND (pt.status IS NULL OR pt.status != 'cancelled')
        `;
        const params = [id];

        if (startDate) {
            query += ' AND date(pt.transaction_date) >= date(?)';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND date(pt.transaction_date) <= date(?)';
            params.push(endDate);
        }

        query += ' ORDER BY pt.transaction_date ASC, pt.id ASC';
        const transactions = db.prepare(query).all(...params);

        // Calculate prior drawings balance before startDate (excluding cancelled)
        let priorDrawings = 0;
        if (startDate) {
            const priorW = (db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total FROM partner_transactions
                WHERE partner_id = ? AND transaction_type = 'withdrawal' AND (status IS NULL OR status != 'cancelled') AND date(transaction_date) < date(?)
            `).get(id, startDate).total || 0);

            const priorR = (db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total FROM partner_transactions
                WHERE partner_id = ? AND transaction_type = 'withdrawal_return' AND (status IS NULL OR status != 'cancelled') AND date(transaction_date) < date(?)
            `).get(id, startDate).total || 0);

            priorDrawings = Math.max(0, priorW - priorR);
        }

        let runningDrawings = priorDrawings;
        let totalWithdrawals = 0;
        let totalReturned = 0;
        let totalPayments = 0;
        let totalCapital = 0;
        let totalProfitDistributions = 0;

        const typeLabels = {
            'withdrawal': 'سحب شخصي للشريك',
            'withdrawal_return': 'رد مبلغ مسحوبات',
            'payment': 'دفعة نقدية مسددة للشريك',
            'capital_contribution': 'مساهمة رأس مال',
            'profit_distribution': 'توزيع أرباح'
        };

        const rows = transactions.map(t => {
            const isWithdrawal = t.transaction_type === 'withdrawal' || t.transaction_type === 'payment' || t.transaction_type === 'profit_distribution';
            const isReturn = t.transaction_type === 'withdrawal_return';
            const isCapital = t.transaction_type === 'capital_contribution';

            if (isWithdrawal) {
                runningDrawings += t.amount;
                if (t.transaction_type === 'withdrawal') totalWithdrawals += t.amount;
                else if (t.transaction_type === 'payment') totalPayments += t.amount;
                else if (t.transaction_type === 'profit_distribution') totalProfitDistributions += t.amount;
            } else if (isReturn) {
                runningDrawings = Math.max(0, runningDrawings - t.amount);
                totalReturned += t.amount;
            } else if (isCapital) {
                totalCapital += t.amount;
            }

            return {
                ...t,
                type_label: typeLabels[t.transaction_type] || t.transaction_type,
                is_addition: isReturn || isCapital,
                running_balance: runningDrawings
            };
        });

        const netWithdrawals = Math.max(0, totalWithdrawals - totalReturned);
        const totalDraws = netWithdrawals + totalPayments + totalProfitDistributions;
        const intactCapital = registeredCapital + (totalCapital || 0);

        res.json({
            partner: getPartnerMetrics(partner),
            statementPeriod: {
                startDate: startDate || null,
                endDate: endDate || null
            },
            opening_balance: priorDrawings,
            capital_balance: intactCapital,
            rows,
            summary: {
                total_withdrawals: totalWithdrawals,
                total_returned: totalReturned,
                net_withdrawals: netWithdrawals,
                total_payments: totalPayments,
                total_capital_contributions: totalCapital,
                total_profit_distributions: totalProfitDistributions,
                total_draws: totalDraws,
                intact_capital: intactCapital,
                closing_balance: intactCapital
            }
        });
    } catch (error) {
        console.error('Error generating partner statement:', error);
        res.status(500).json({ error: error.message });
    }
};

// 14. Download Partner Statement PDF
exports.downloadPartnerStatementPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
        if (!partner) return res.status(404).json({ error: 'الشريك غير موجود' });

        const registeredCapital = Number(partner.capital_contribution) || 0;

        const initialDepositRow = db.prepare(`
            SELECT * FROM partner_transactions
            WHERE partner_id = ? AND transaction_type = 'capital_contribution' 
              AND (notes = 'إيداع رأس المال الافتتاحي في الخزينة' OR description LIKE 'رأس مال مساهم به عند بدء الشراكة%')
              AND (status IS NULL OR status != 'cancelled')
        `).get(id);
        const initialDepositAmount = initialDepositRow ? (Number(initialDepositRow.amount) || 0) : 0;

        let query = `
            SELECT pt.*, fa.name as account_name
            FROM partner_transactions pt
            LEFT JOIN financial_accounts fa ON pt.account_id = fa.id
            WHERE pt.partner_id = ? AND (pt.status IS NULL OR pt.status != 'cancelled')
        `;
        const params = [id];

        if (startDate) {
            query += ' AND date(pt.transaction_date) >= date(?)';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND date(pt.transaction_date) <= date(?)';
            params.push(endDate);
        }

        query += ' ORDER BY pt.transaction_date ASC, pt.id ASC';
        const transactions = db.prepare(query).all(...params);

        let priorDrawings = 0;
        if (startDate) {
            const priorW = (db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total FROM partner_transactions
                WHERE partner_id = ? AND transaction_type = 'withdrawal' AND (status IS NULL OR status != 'cancelled') AND date(transaction_date) < date(?)
            `).get(id, startDate).total || 0);

            const priorR = (db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total FROM partner_transactions
                WHERE partner_id = ? AND transaction_type = 'withdrawal_return' AND (status IS NULL OR status != 'cancelled') AND date(transaction_date) < date(?)
            `).get(id, startDate).total || 0);

            priorDrawings = Math.max(0, priorW - priorR);
        }

        let runningDrawings = priorDrawings;
        let totalWithdrawals = 0;
        let totalReturned = 0;
        let totalPayments = 0;
        let totalCapital = 0;
        let totalProfitDistributions = 0;

        const typeLabels = {
            'withdrawal': 'سحب شخصي',
            'withdrawal_return': 'رد مسحوبات',
            'payment': 'دفعة نقدية',
            'capital_contribution': 'مساهمة رأس مال',
            'profit_distribution': 'توزيع أرباح'
        };

        const rowsHtml = transactions.map(t => {
            const isWithdrawal = t.transaction_type === 'withdrawal' || t.transaction_type === 'payment' || t.transaction_type === 'profit_distribution';
            const isReturn = t.transaction_type === 'withdrawal_return';
            const isCapital = t.transaction_type === 'capital_contribution';

            if (isWithdrawal) {
                runningDrawings += t.amount;
                if (t.transaction_type === 'withdrawal') totalWithdrawals += t.amount;
                else if (t.transaction_type === 'payment') totalPayments += t.amount;
                else if (t.transaction_type === 'profit_distribution') totalProfitDistributions += t.amount;
            } else if (isReturn) {
                runningDrawings = Math.max(0, runningDrawings - t.amount);
                totalReturned += t.amount;
            } else if (isCapital) {
                totalCapital += t.amount;
            }

            const formattedDate = new Date(t.transaction_date).toLocaleDateString('en-GB');
            const typeBadgeClass = (isReturn || isCapital) ? 'type-badge-green' : 'type-badge-red';

            return `
                <tr>
                    <td style="white-space: nowrap;">${formattedDate}</td>
                    <td><span class="${typeBadgeClass}">${typeLabels[t.transaction_type] || t.transaction_type}</span></td>
                    <td style="text-align: right;">${t.description || '-'} ${t.notes ? ` - <span style="color: #92400e; font-size: 10px; font-weight: 600;">(ملاحظة: ${t.notes})</span>` : ''} ${t.reference ? `(مرجع: ${t.reference})` : ''}</td>
                    <td dir="ltr" style="font-weight: 700; color: ${(isReturn || isCapital) ? '#047857' : '#b91c1c'};">${(isReturn || isCapital) ? '+' : '-'}${Number(t.amount).toLocaleString()}</td>
                    <td>${t.payment_method || 'نقدي'}${t.account_name ? ` (${t.account_name})` : ''}</td>
                    <td dir="ltr" style="font-weight: 700;">${Number(runningDrawings).toLocaleString()} ج.م</td>
                </tr>
            `;
        }).join('');

        const netWithdrawals = Math.max(0, totalWithdrawals - totalReturned);
        const intactCapital = registeredCapital + (totalCapital || 0);

        const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>كشف حساب الشريك - ${partner.name}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
                * { box-sizing: border-box; }
                body { 
                    font-family: 'Cairo', Tahoma, sans-serif; 
                    padding: 25px; 
                    margin: 0; 
                    color: #0f172a; 
                    background: #ffffff;
                    font-size: 12px;
                }
                .header-table { width: 100%; border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
                .title-main { font-size: 22px; font-weight: 800; color: #0369a1; margin: 0; }
                .title-sub { font-size: 14px; font-weight: 600; color: #64748b; margin-top: 4px; }
                
                .info-grid {
                    display: table;
                    width: 100%;
                    margin-bottom: 20px;
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    background: #f8fafc;
                }
                .info-row { display: table-row; }
                .info-cell {
                    display: table-cell;
                    padding: 10px 14px;
                    border-bottom: 1px solid #e2e8f0;
                    border-left: 1px solid #e2e8f0;
                    width: 33.33%;
                }
                .info-cell strong { color: #334155; display: inline-block; min-width: 90px; }
                
                table.main-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                }
                table.main-table th {
                    background-color: #0284c7;
                    color: #ffffff;
                    font-weight: 700;
                    padding: 8px;
                    border: 1px solid #0284c7;
                    text-align: center;
                }
                table.main-table td {
                    padding: 8px;
                    border: 1px solid #cbd5e1;
                    text-align: center;
                }
                table.main-table tr:nth-child(even) { background-color: #f8fafc; }
                
                .type-badge-green { background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
                .type-badge-red { background: #fee2e2; color: #b91c1c; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
                
                .summary-card {
                    margin-top: 25px;
                    background: #f1f5f9;
                    border: 2px solid #94a3b8;
                    border-radius: 8px;
                    padding: 15px;
                    page-break-inside: avoid;
                }
                .summary-grid { display: table; width: 100%; }
                .summary-cell { display: table-cell; padding: 8px; width: 20%; text-align: center; }
                .summary-val { font-size: 15px; font-weight: 800; margin-top: 4px; color: #0f172a; }
                
                .footer-stamp {
                    margin-top: 35px;
                    display: table;
                    width: 100%;
                    page-break-inside: avoid;
                }
                .footer-col { display: table-cell; width: 50%; text-align: center; }
                .sign-line { margin-top: 40px; border-top: 1px dashed #64748b; width: 180px; display: inline-block; }
            </style>
        </head>
        <body>
            <table class="header-table">
                <tr>
                    <td>
                        <h1 class="title-main">كشف حساب الشريك</h1>
                        <div class="title-sub">مجموعة الحاج رفعت / هنداكوتي جروب</div>
                    </td>
                    <td style="text-align: left; vertical-align: middle;">
                        <div style="font-size: 11px; color: #64748b;">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
                    </td>
                </tr>
            </table>

            <div class="info-grid">
                <div class="info-row">
                    <div class="info-cell"><strong>اسم الشريك:</strong> ${partner.name}</div>
                    <div class="info-cell"><strong>نسبة الشراكة:</strong> ${partner.share_percentage}%</div>
                    <div class="info-cell"><strong>رقم الهاتف:</strong> ${partner.phone || '-'}</div>
                </div>
                <div class="info-row">
                    <div class="info-cell"><strong>رأس المال المسجل:</strong> ${registeredCapital.toLocaleString()} ج.م</div>
                    <div class="info-cell"><strong>تاريخ البدء:</strong> ${partner.start_date || '-'}</div>
                    <div class="info-cell"><strong>الفترة المحددة:</strong> ${startDate || 'البداية'} إلى ${endDate || 'اليوم'}</div>
                </div>
                ${partner.notes ? `
                <div class="info-row">
                    <div class="info-cell" style="width: 100%; border-bottom: none;" colspan="3"><strong>ملاحظات:</strong> ${partner.notes}</div>
                </div>` : ''}
            </div>

            <div style="margin-bottom: 8px; font-weight: 700; color: #1e293b;">
                الرصيد الافتتاحي قبل الفترة: <span dir="ltr" style="font-size: 13px; color: #0369a1;">${Number(openingBalance).toLocaleString()} ج.م</span>
            </div>

            <table class="main-table">
                <thead>
                    <tr>
                        <th style="width: 12%;">التاريخ</th>
                        <th style="width: 15%;">نوع الحركة</th>
                        <th style="width: 33%;">البيان والتفاصيل</th>
                        <th style="width: 13%;">المبلغ</th>
                        <th style="width: 13%;">طريقة الدفع</th>
                        <th style="width: 14%;">رصيد المسحوبات</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml.length > 0 ? rowsHtml : `
                        <tr>
                            <td colspan="6" style="padding: 20px; color: #64748b;">لا توجد حركات مسجلة خلال الفترة المحددة.</td>
                        </tr>
                    `}
                </tbody>
            </table>

            <div class="summary-card">
                <div class="summary-grid">
                    <div class="summary-cell">
                        <div style="color: #475569;">إجمالي مساهمات رأس المال</div>
                        <div class="summary-val" style="color: #047857;">${totalCapital.toLocaleString()} ج.م</div>
                    </div>
                    <div class="summary-cell">
                        <div style="color: #475569;">إجمالي المسحوبات</div>
                        <div class="summary-val" style="color: #b91c1c;">${totalWithdrawals.toLocaleString()} ج.م</div>
                    </div>
                    <div class="summary-cell">
                        <div style="color: #475569;">المسترد للخزينة</div>
                        <div class="summary-val" style="color: #059669;">${totalReturned.toLocaleString()} ج.م</div>
                    </div>
                    <div class="summary-cell">
                        <div style="color: #475569;">صافي المسحوبات المستحقة</div>
                        <div class="summary-val" style="color: #dc2626;">${netWithdrawals.toLocaleString()} ج.م</div>
                    </div>
                    <div class="summary-cell">
                        <div style="color: #475569;">رأس المال المحفوظ</div>
                        <div class="summary-val" style="color: #047857; font-size: 17px;">${intactCapital.toLocaleString()} ج.م</div>
                        <div style="font-size: 10px; color: #059669; font-weight: 700;">(ثابت لا يُخصم منه المسحوبات)</div>
                    </div>
                </div>
            </div>

            <div class="footer-stamp">
                <div class="footer-col">
                    <strong>توقيع الشريك</strong>
                    <div><span class="sign-line"></span></div>
                </div>
                <div class="footer-col">
                    <strong>إدارة الحسابات والمالية</strong>
                    <div><span class="sign-line"></span></div>
                </div>
            </div>
        </body>
        </html>
        `;

        const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
        const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
        if (fs.existsSync(chromePath)) launchOpts.executablePath = chromePath;
        else if (fs.existsSync(edgePath)) launchOpts.executablePath = edgePath;

        const puppeteer = require('puppeteer');
        let browser;
        try {
            browser = await puppeteer.launch(launchOpts);
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }
            });

            res.setHeader('Content-disposition', `inline; filename=partner_statement_${id}.pdf`);
            res.setHeader('Content-type', 'application/pdf');
            res.end(pdfBuffer);
        } catch (pdfError) {
            console.error('Puppeteer PDF error:', pdfError.message);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html + '<script>window.print();</script>');
        } finally {
            if (browser) await browser.close();
        }
    } catch (error) {
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        } else {
            console.error('PDF error after headers sent:', error.message);
            res.end();
        }
    }
};

// 15. Download Partner Statement Excel
exports.downloadPartnerStatementExcel = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
        if (!partner) return res.status(404).json({ error: 'الشريك غير موجود' });

        const registeredCapital = Number(partner.capital_contribution) || 0;

        const initialDepositRow = db.prepare(`
            SELECT * FROM partner_transactions
            WHERE partner_id = ? AND transaction_type = 'capital_contribution' 
              AND (notes = 'إيداع رأس المال الافتتاحي في الخزينة' OR description LIKE 'رأس مال مساهم به عند بدء الشراكة%')
              AND (status IS NULL OR status != 'cancelled')
        `).get(id);
        const initialDepositAmount = initialDepositRow ? (Number(initialDepositRow.amount) || 0) : 0;

        let query = `
            SELECT pt.*, fa.name as account_name
            FROM partner_transactions pt
            LEFT JOIN financial_accounts fa ON pt.account_id = fa.id
            WHERE pt.partner_id = ? AND (pt.status IS NULL OR pt.status != 'cancelled')
        `;
        const params = [id];

        if (startDate) {
            query += ' AND date(pt.transaction_date) >= date(?)';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND date(pt.transaction_date) <= date(?)';
            params.push(endDate);
        }

        query += ' ORDER BY pt.transaction_date ASC, pt.id ASC';
        const transactions = db.prepare(query).all(...params);

        let priorDrawings = 0;
        if (startDate) {
            const priorW = (db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total FROM partner_transactions
                WHERE partner_id = ? AND transaction_type = 'withdrawal' AND (status IS NULL OR status != 'cancelled') AND date(transaction_date) < date(?)
            `).get(id, startDate).total || 0);

            const priorR = (db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total FROM partner_transactions
                WHERE partner_id = ? AND transaction_type = 'withdrawal_return' AND (status IS NULL OR status != 'cancelled') AND date(transaction_date) < date(?)
            `).get(id, startDate).total || 0);

            priorDrawings = Math.max(0, priorW - priorR);
        }

        const workbook = new ExcelJS.Workbook();
        const sheet1 = workbook.addWorksheet('كشف الحساب', { views: [{ rightToLeft: true }] });

        sheet1.columns = [
            { header: 'التاريخ', key: 'date', width: 15 },
            { header: 'نوع الحركة', key: 'type', width: 22 },
            { header: 'البيان والتفاصيل', key: 'description', width: 35 },
            { header: 'رقم المرجع', key: 'reference', width: 16 },
            { header: 'مساهمة / رد (+) أو سحب (-)', key: 'amount', width: 22 },
            { header: 'طريقة الدفع والجهة', key: 'method', width: 22 },
            { header: 'رصيد المسحوبات', key: 'balance', width: 18 }
        ];

        sheet1.getRow(1).font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        sheet1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
        sheet1.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

        const typeLabels = {
            'withdrawal': 'سحب شخصي',
            'withdrawal_return': 'رد مبالغ مسحوبات',
            'payment': 'دفعة نقدية مسددة',
            'capital_contribution': 'مساهمة رأس مال',
            'profit_distribution': 'توزيع أرباح'
        };

        let runningDrawings = priorDrawings;
        let totalWithdrawals = 0;
        let totalReturned = 0;
        let totalPayments = 0;
        let totalCapital = 0;
        let totalProfitDistributions = 0;

        transactions.forEach(t => {
            const isWithdrawal = t.transaction_type === 'withdrawal' || t.transaction_type === 'payment' || t.transaction_type === 'profit_distribution';
            const isReturn = t.transaction_type === 'withdrawal_return';
            const isCapital = t.transaction_type === 'capital_contribution';

            if (isWithdrawal) {
                runningDrawings += t.amount;
                if (t.transaction_type === 'withdrawal') totalWithdrawals += t.amount;
                else if (t.transaction_type === 'payment') totalPayments += t.amount;
                else if (t.transaction_type === 'profit_distribution') totalProfitDistributions += t.amount;
            } else if (isReturn) {
                runningDrawings = Math.max(0, runningDrawings - t.amount);
                totalReturned += t.amount;
            } else if (isCapital) {
                totalCapital += t.amount;
            }

            const row = sheet1.addRow({
                date: new Date(t.transaction_date).toLocaleDateString('en-GB'),
                type: typeLabels[t.transaction_type] || t.transaction_type,
                description: t.description || '-',
                reference: t.reference || '-',
                amount: ((isReturn || isCapital) ? '+' : '-') + Number(t.amount).toLocaleString(),
                method: (t.payment_method || 'نقدي') + (t.account_name ? ` (${t.account_name})` : ''),
                balance: Number(runningDrawings).toLocaleString() + ' ج.م'
            });

            row.font = { name: 'Arial', size: 11 };
            row.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        const netWithdrawals = Math.max(0, totalWithdrawals - totalReturned);
        const intactCapital = registeredCapital + (totalCapital || 0);

        // Summary Worksheet
        const sheet2 = workbook.addWorksheet('ملخص الشريك', { views: [{ rightToLeft: true }] });
        sheet2.columns = [{ width: 32 }, { width: 35 }];

        const summaryRows = [
            ['اسم الشريك', partner.name],
            ['نسبة الشراكة', `${partner.share_percentage}%`],
            ['رقم الهاتف', partner.phone || '-'],
            ['رأس المال المسجل (ثابت)', registeredCapital],
            ['إجمالي مساهمات زيادة رأس المال', totalCapital],
            ['رأس المال المحفوظ بالكامل (لا يُخصم منه السحب)', intactCapital],
            ['إجمالي السحوبات الشخصية', totalWithdrawals],
            ['إجمالي المبالغ المستردة للخزينة', totalReturned],
            ['صافي المسحوبات المستحقة على الشريك', netWithdrawals],
            ['إجمالي الدفعات المسددة', totalPayments],
            ['إجمالي توزيعات الأرباح', totalProfitDistributions],
            ['تاريخ استخراج التقرير', new Date().toLocaleString('ar-EG')]
        ];

        summaryRows.forEach(sr => {
            const row = sheet2.addRow(sr);
            row.font = { name: 'Arial', size: 11, bold: true };
            row.alignment = { horizontal: 'right', vertical: 'middle' };
        });

        res.setHeader('Content-Disposition', `attachment; filename=partner_statement_${id}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error exporting partner Excel:', error);
        res.status(500).json({ error: error.message });
    }
};
