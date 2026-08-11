/**
 * Historical Metrics Analysis for EcoTrack Automation
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const HISTORY_FILE = path.join(__dirname, '../Test Results/history_data.json');

async function recordCurrentRun() {
    // Check both potential paths (local and artifact download path in CI)
    const reportPaths = [
        path.join(__dirname, '../automation/reports/JSON/execution-results.json'),
        path.join(__dirname, '../all-results/selenium-test-results/JSON/execution-results.json')
    ];

    let reportPath = null;
    for (const p of reportPaths) {
        if (fs.existsSync(p)) {
            reportPath = p;
            break;
        }
    }

    if (!reportPath) {
        console.warn('Current run JSON results not found. Skipping historical recording.');
        return;
    }

    const currentResults = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const passed = currentResults.filter(t => t.status === 'PASSED').length;
    const total = currentResults.length;
    const rate = total > 0 ? (passed / total) * 100 : 0;

    const record = {
        timestamp: new Date().toISOString(),
        total,
        passed,
        failed: total - passed,
        passRate: rate.toFixed(2)
    };

    const historyDir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });

    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
        try {
            history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        } catch(e) {}
    }
    history.push(record);

    if (history.length > 50) history.shift();

    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    console.log('✅ Current run recorded in historical data.');

    await generateTrendReport(history);
}

async function generateTrendReport(history) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Quality Trends');

    sheet.columns = [
        { header: 'Run Timestamp', key: 'timestamp', width: 25 },
        { header: 'Executed', key: 'total', width: 12 },
        { header: 'Passed', key: 'passed', width: 12 },
        { header: 'Failed', key: 'failed', width: 12 },
        { header: 'Pass Rate (%)', key: 'passRate', width: 15 }
    ];

    history.forEach(h => sheet.addRow(h));

    const reportDir = path.join(__dirname, '../Test Results/Summary');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

    const reportPath = path.join(reportDir, 'Historical_Quality_Trends.xlsx');
    await workbook.xlsx.writeFile(reportPath);
    console.log(`✅ Trend report generated: ${reportPath}`);
}

recordCurrentRun().catch(console.error);
