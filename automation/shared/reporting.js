const fs = require('fs');
const path = require('path');

class Reporter {
    constructor() {
        this.results = [];
        this.reportsDir = path.join(__dirname, '../reports');
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }

    logResult(testCase, category, status, duration, details = {}, error = null) {
        const result = {
            id: `TC-${this.results.length + 1001}`,
            testCase,
            category,
            status, // PASS, FAIL, SKIP, BLOCKED
            duration,
            timestamp: new Date().toISOString(),
            details,
            error: error ? error.message || error : null,
            stack: error ? error.stack : null
        };
        this.results.push(result);
        console.log(`[${status}] ${category}: ${testCase} (${duration}ms)`);
        if (error) console.error(error);
    }

    generateReports() {
        const allResults = this.results;
        const passedResults = allResults.filter(r => r.status === 'PASS');

        // 1. JSON - FULL RAW DATA
        const jsonPath = path.join(this.reportsDir, 'full_results.json');
        fs.writeFileSync(jsonPath, JSON.stringify(allResults, null, 2));

        // 2. LOGS - ALL RESULTS
        const logPath = path.join(this.reportsDir, 'execution.log');
        const logContent = allResults.map(r =>
            `[${r.timestamp}] [${r.status}] ${r.category} - ${r.testCase} (${r.duration}ms)${r.error ? '\nError: ' + r.error : ''}`
        ).join('\n');
        fs.writeFileSync(logPath, logContent);

        // 3. EXCEL/CSV - ONLY PASSED
        const csvPath = path.join(this.reportsDir, 'passed_results.csv');
        const csvHeader = 'ID,Category,Test Case,Status,Duration(ms),Timestamp\n';
        const csvRows = passedResults.map(r =>
            `"${r.id}","${r.category}","${r.testCase}","${r.status}",${r.duration},"${r.timestamp}"`
        ).join('\n');
        fs.writeFileSync(csvPath, csvHeader + csvRows);

        // 4. HTML - ONLY PASSED (Summary Dashboard)
        const htmlPath = path.join(this.reportsDir, 'dashboard.html');
        const htmlContent = this.generateHtml(passedResults, allResults.length);
        fs.writeFileSync(htmlPath, htmlContent);

        console.log(`\nReports generated in ${this.reportsDir}`);
    }

    generateHtml(passed, totalCount) {
        const passCount = passed.length;
        const allResults = this.results;
        const failCount = allResults.filter(r => r.status === 'FAIL').length;
        const blockedCount = allResults.filter(r => r.status === 'BLOCKED').length;
        const skipCount = allResults.filter(r => r.status === 'SKIP').length;
        const passRate = totalCount > 0 ? ((passCount / totalCount) * 100).toFixed(1) : 0;

        // Group blocked reasons
        const blockedReasons = [...new Set(allResults.filter(r => r.status === 'BLOCKED').map(r => r.details.reason || 'Unknown'))];

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>EcoTrack Enterprise Automation Dashboard</title>
    <style>
        :root {
            --bg: #0f172a;
            --card: #1e293b;
            --text: #f8fafc;
            --primary: #10b981;
            --fail: #ef4444;
            --blocked: #f59e0b;
            --border: #334155;
        }
        body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 1px solid var(--border); padding-bottom: 20px; }
        h1 { margin: 0; color: var(--primary); font-size: 28px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .card { background: var(--card); border: 1px solid var(--border); padding: 24px; border-radius: 12px; text-align: center; }
        .card h3 { margin: 0; color: #94a3b8; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
        .card .val { font-size: 36px; font-weight: 800; margin-top: 10px; }
        .val.pass { color: var(--primary); }
        .val.fail { color: var(--fail); }
        .val.blocked { color: var(--blocked); }

        .alert-box { background: rgba(245, 158, 11, 0.1); border: 1px solid var(--blocked); color: var(--blocked); padding: 15px; border-radius: 8px; margin-bottom: 30px; }

        table { width: 100%; border-collapse: collapse; background: var(--card); border-radius: 12px; overflow: hidden; border: 1px solid var(--border); }
        th { background: #111827; padding: 16px; text-align: left; font-size: 12px; color: #94a3b8; text-transform: uppercase; }
        td { padding: 16px; border-bottom: 1px solid var(--border); font-size: 14px; }
        .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
        .badge-pass { background: rgba(16, 185, 129, 0.2); color: var(--primary); }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>EcoTrack AI Automation Dashboard</h1>
            <p style="color: #94a3b8; margin: 5px 0 0 0;">Execution Timestamp: ${new Date().toLocaleString()}</p>
        </div>
        <div class="badge badge-pass" style="font-size: 14px; padding: 10px 20px;">BUILD STABLE</div>
    </div>

    <div class="metrics">
        <div class="card"><h3>Total Tests</h3><div class="val">${totalCount}</div></div>
        <div class="card"><h3>Passed</h3><div class="val pass">${passCount}</div></div>
        <div class="card"><h3>Failed</h3><div class="val fail">${failCount}</div></div>
        <div class="card"><h3>Blocked</h3><div class="val blocked">${blockedCount}</div></div>
        <div class="card"><h3>Pass Rate</h3><div class="val" style="color: #38bdf8;">${passRate}%</div></div>
    </div>

    ${blockedCount > 0 ? `
    <div class="alert-box">
        <strong>⚠️ ATTENTION: ${blockedCount} Tests were BLOCKED</strong>
        <p style="margin: 5px 0 0 0;">Reasons detected: ${blockedReasons.join(', ')}. Please check mobile build paths.</p>
    </div>
    ` : ''}

    <h2 style="font-size: 18px; margin-bottom: 20px;">✅ Successfully Exported Test Cases (${passCount})</h2>
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Category</th>
                <th>Test Case</th>
                <th>Status</th>
                <th>Duration</th>
            </tr>
        </thead>
        <tbody>
            ${passed.map(r => `
            <tr>
                <td><strong>${r.id}</strong></td>
                <td>${r.category}</td>
                <td>${r.testCase}</td>
                <td><span class="badge badge-pass">PASSED</span></td>
                <td>${r.duration}ms</td>
            </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;
    }
}

module.exports = new Reporter();
