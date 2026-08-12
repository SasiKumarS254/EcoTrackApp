const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function generateExcelReport(results) {
    const reportDir = path.join(__dirname, '../reports/Excel');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

    const createSheet = (workbook, name, tests) => {
        const sheet = workbook.addWorksheet(name);
        sheet.columns = [
            { header: 'Test ID', key: 'id', width: 15 },
            { header: 'Module', key: 'module', width: 20 },
            { header: 'Priority', key: 'priority', width: 10 },
            { header: 'Test Name', key: 'name', width: 40 },
            { header: 'Expected Result', key: 'expected', width: 40 },
            { header: 'Actual Result', key: 'actual', width: 40 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Duration (ms)', key: 'duration', width: 15 }
        ];
        tests.forEach(t => {
            const row = sheet.addRow(t);
            const statusCell = row.getCell('status');
            if (t.status === 'PASSED') statusCell.font = { color: { argb: 'FF00B050' }, bold: true };
            if (t.status === 'FAILED') statusCell.font = { color: { argb: 'FFFF0000' }, bold: true };
        });
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    };

    // 1. Selenium_Testing_Report.xlsx (All Cases)
    const fullWorkbook = new ExcelJS.Workbook();
    createSheet(fullWorkbook, 'All Test Cases', results);
    await fullWorkbook.xlsx.writeFile(path.join(reportDir, 'Selenium_Testing_Report.xlsx'));

    // 2. Passed_Test_Cases.xlsx
    const passedWorkbook = new ExcelJS.Workbook();
    createSheet(passedWorkbook, 'Passed Tests', results.filter(r => r.status === 'PASSED'));
    await passedWorkbook.xlsx.writeFile(path.join(reportDir, 'Passed_Test_Cases.xlsx'));

    // 3. Failed_Test_Cases.xlsx
    const failedWorkbook = new ExcelJS.Workbook();
    createSheet(failedWorkbook, 'Failed Tests', results.filter(r => r.status === 'FAILED' || r.status === 'BLOCKED'));
    await failedWorkbook.xlsx.writeFile(path.join(reportDir, 'Failed_Test_Cases.xlsx'));

    // 4. Summary_Report.xlsx
    const summaryWorkbook = new ExcelJS.Workbook();
    const summarySheet = summaryWorkbook.addWorksheet('Summary');
    const passedCount = results.filter(r => r.status === 'PASSED').length;
    const failedCount = results.filter(r => r.status === 'FAILED').length;
    const total = results.length;

    summarySheet.addRows([
        ['EcoTrack Selenium Summary Report'],
        ['Total Executed', total],
        ['Total Passed', passedCount],
        ['Total Failed', failedCount],
        ['Pass Rate', `${((passedCount / total) * 100).toFixed(2)}%`],
        ['Execution Date', new Date().toLocaleString()]
    ]);
    summarySheet.getColumn(1).width = 30;
    summarySheet.getRow(1).font = { size: 14, bold: true };
    await summaryWorkbook.xlsx.writeFile(path.join(reportDir, 'Summary_Report.xlsx'));

    console.log(`Professional Excel reports (x4) generated in ${reportDir}`);
}

module.exports = { generateExcelReport };
