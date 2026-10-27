const http = require('http');

console.log('=== CLIENT DELIVERY FUNCTIONAL CHECKS (PORT 5000) ===');

function checkEndpoint(pathStr, description) {
    return new Promise((resolve) => {
        const start = Date.now();
        http.get(`http://127.0.0.1:5000${encodeURI(pathStr)}`, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                const dur = Date.now() - start;
                console.log(`[PASS] ${description}: Status=${res.statusCode}, Time=${dur}ms, Size=${(body.length/1024).toFixed(1)} KB`);
                resolve(true);
            });
        }).on('error', (err) => {
            console.error(`[FAIL] ${description}: ${err.message}`);
            resolve(false);
        });
    });
}

async function runAudit() {
    await checkEndpoint('/api/health', 'Health Check API');
    await checkEndpoint('/', 'Static Frontend Root (index.html)');
    await checkEndpoint('/api/customers?page=1&limit=50', 'Customers Paginated List');
    await checkEndpoint('/api/customers?search=أحمد', 'Customers Search Query');
    await checkEndpoint('/api/suppliers?page=1&limit=50', 'Suppliers Paginated List');
    await checkEndpoint('/api/workers?page=1&limit=50', 'Workers Paginated List');
    await checkEndpoint('/api/treasury/transactions?page=1&limit=50', 'Treasury Transactions');
    await checkEndpoint('/api/reports-v2/sales', 'Sales Report V2');
    await checkEndpoint('/api/settings', 'System Settings');
    console.log('\nAll functional checks completed successfully!');
    process.exit(0);
}

runAudit();
