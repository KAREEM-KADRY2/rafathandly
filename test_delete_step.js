const db = require('./backend/src/db');

try {
    const testTx = db.transaction(() => {
        const id = 2; // test on worker 2
        console.log('Testing delete steps for worker id:', id);
        
        console.log('Step 1: delete worker_attendance...');
        const r1 = db.prepare('DELETE FROM worker_attendance WHERE worker_id = ?').run(id);
        console.log('Deleted attendance:', r1.changes);

        console.log('Step 2: delete worker_withdrawals...');
        const r2 = db.prepare('DELETE FROM worker_withdrawals WHERE worker_id = ?').run(id);
        console.log('Deleted withdrawals:', r2.changes);

        console.log('Step 3: delete worker_leaves...');
        const r3 = db.prepare('DELETE FROM worker_leaves WHERE worker_id = ?').run(id);
        console.log('Deleted leaves:', r3.changes);

        console.log('Step 4: delete opening_balances with single quotes...');
        const r4 = db.prepare("DELETE FROM opening_balances WHERE entity_type = 'worker' AND entity_id = ?").run(id);
        console.log('Deleted opening_balances:', r4.changes);

        console.log('Step 5: delete workers...');
        const r5 = db.prepare('DELETE FROM workers WHERE id = ?').run(id);
        console.log('Deleted worker:', r5.changes);

        // ROLLBACK so we don't accidentally delete yet
        throw new Error('ROLLBACK_INTENTIONAL');
    });

    testTx();
} catch (e) {
    if (e.message === 'ROLLBACK_INTENTIONAL') {
        console.log('SUCCESS! ALL 5 STEPS PASSED PERFECTLY!');
    } else {
        console.error('FAILED! Error was:', e);
    }
}
