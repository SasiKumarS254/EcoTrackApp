/**
 * Historical Metrics Analysis for EcoTrack Automation
 * Aggregates results from multiple runs to track quality trends.
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const HISTORY_FILE = path.join(__dirname, '../Test Results/history_data.json');

async function recordCurrentRun() {
    const reportPath = path.join(__dirname, '../automation/reports/JSON/execution-results.json');
    if (!fs.existsSync(reportPath)) {
        console.warn('Current run JSON results not found. Skipping historical recording.');
        return;
    }

    const currentResults = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const passed = currentResults.filter(t => t.status === 'PASSED').length;
    const total = currentResults.length;
    const rate = (passed / total) * 100;

    const record = {
        timestamp: new Date().toISOString(),
        total,
        passed,
        failed: total - passed,
        passRate: rate.toFixed(2)
    };

    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
        history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
    history.push(record);

    // Keep only last 50 runs
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

    const reportPath = path.join(__dirname, '../Test Results/Summary/Historical_Quality_Trends.xlsx');
    await workbook.xlsx.writeFile(reportPath);
    console.log(`✅ Trend report generated: ${reportPath}`);
}

recordCurrentRun().catch(console.error);
