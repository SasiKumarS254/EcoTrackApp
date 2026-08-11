const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
const CONCURRENT_USERS = 100;
const DURATION_MS = 60000; // 1 minute

async function simulateUser(id) {
    const startTime = Date.now();
    let requests = 0;
    let errors = 0;
    const latencies = [];

    while (Date.now() - startTime < DURATION_MS) {
        try {
            const reqStart = Date.now();
            await axios.get(`${BASE_URL}/marketplace`, { timeout: 2000 });
            latencies.push(Date.now() - reqStart);
            requests++;
        } catch (err) {
            errors++;
            // If server is totally down, don't flood with errors
            if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        await new Promise(r => setTimeout(r, 100)); // Small delay between requests
    }

    return { id, requests, errors, avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length || 0 };
}

async function runLoadTest() {
    console.log(`Starting load test with ${CONCURRENT_USERS} concurrent users for ${DURATION_MS / 1000}s...`);

    const userPromises = [];
    for (let i = 0; i < CONCURRENT_USERS; i++) {
        userPromises.push(simulateUser(i));
    }

    const results = await Promise.all(userPromises);

    const totalRequests = results.reduce((sum, r) => sum + r.requests, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
    const avgLatency = results.reduce((sum, r) => sum + r.avgLatency, 0) / results.length;

    const summary = {
        concurrentUsers: CONCURRENT_USERS,
        duration: `${DURATION_MS / 1000}s`,
        totalRequests,
        totalErrors,
        errorRate: `${((totalErrors / totalRequests) * 100).toFixed(2)}%`,
        avgLatency: `${avgLatency.toFixed(2)}ms`,
        throughput: `${(totalRequests / (DURATION_MS / 1000)).toFixed(2)} req/s`
    };

    const reportPath = path.join(__dirname, 'reports/load_test_report.json');
    if (!fs.existsSync(path.dirname(reportPath))) fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));

    console.log('Load Test Results:');
    console.table(summary);
}

runLoadTest();
