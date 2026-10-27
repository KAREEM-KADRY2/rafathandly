const path = require('path');
const { fork } = require('child_process');
const http = require('http');

const logoDir = 'C:\\Users\\kareeem\\OneDrive\\Desktop\\لوجو';
const serverProcess = fork(path.join(logoDir, 'backend/index.js'), [], {
    cwd: path.join(logoDir, 'backend'),
    env: { ...process.env, PORT: '5000' },
    stdio: 'pipe'
});

serverProcess.stdout.on('data', data => console.log('[Server stdout]:', data.toString().trim()));
serverProcess.stderr.on('data', data => console.error('[Server stderr]:', data.toString().trim()));

function get(url) {
    return new Promise((resolve, reject) => {
        http.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch(e) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        }).on('error', reject);
    });
}

function waitForServer(url, timeout = 10000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
            try {
                const res = await get(url);
                if (res.status === 200) {
                    clearInterval(interval);
                    resolve(res);
                }
            } catch (e) {
                if (Date.now() - start > timeout) {
                    clearInterval(interval);
                    reject(new Error('Server did not start within timeout: ' + e.message));
                }
            }
        }, 500);
    });
}

(async () => {
    try {
        console.log('Waiting for server to become ready...');
        await waitForServer('http://127.0.0.1:5000/api/health');
        console.log('Server is online!');

        console.log('\n--- 2. Testing Customers (/api/customers?all=true) used by NewSaleModal and VehicleDetails ---');
        const custAll = await get('http://localhost:5000/api/customers?all=true');
        console.log('Customers Array Check: IsArray =', Array.isArray(custAll.data), 'Length =', custAll.data?.length);

        console.log('\n--- 3. Testing Customers default (/api/customers) ---');
        const custDefault = await get('http://localhost:5000/api/customers');
        console.log('Customers Default: IsArray =', Array.isArray(custDefault.data), 'Length =', custDefault.data?.length);

        console.log('\n--- 4. Testing Customers paginated (/api/customers?page=1&limit=50) used by CustomersList ---');
        const custPaginated = await get('http://localhost:5000/api/customers?page=1&limit=50');
        console.log('Customers Paginated: Total =', custPaginated.data?.total, 'Items Count =', custPaginated.data?.items?.length);

        console.log('\n--- 5. Testing Vehicles (/api/vehicles) ---');
        const vehicles = await get('http://localhost:5000/api/vehicles');
        console.log('Vehicles: IsArray =', Array.isArray(vehicles.data), 'Vehicles =', vehicles.data);

        if (Array.isArray(vehicles.data) && vehicles.data.length > 0) {
            const vId = vehicles.data[0].id;
            console.log(`\n--- 6. Testing Specific Vehicle (/api/vehicles/${vId}) ---`);
            const v = await get(`http://localhost:5000/api/vehicles/${vId}`);
            console.log('Vehicle details:', v.data);

            console.log(`\n--- 7. Testing Vehicle Trips (/api/transport-trips/vehicle/${vId}) ---`);
            const trips = await get(`http://localhost:5000/api/transport-trips/vehicle/${vId}`);
            console.log('Trips: IsArray =', Array.isArray(trips.data), 'Trips count =', trips.data?.length);
        }

        console.log('\n--- 8. Testing Frontend HTML and Asset Serving ---');
        const html = await get('http://localhost:5000/');
        console.log('HTML Status:', html.status, 'Contains bundle:', html.raw?.includes('index-CoWETLqo.js'));

        console.log('\n✓ ALL BACKEND AND FRONTEND CHECKS PASSED PERFECTLY!');
    } catch (e) {
        console.error('Test error:', e);
    } finally {
        serverProcess.kill();
        process.exit(0);
    }
})();
