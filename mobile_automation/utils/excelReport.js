const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function generateMobileExcelReport(results) {
    const reportDir = path.join(__dirname, '../reports/Excel');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

    const createSheet = (workbook, name, tests) => {
        const sheet = workbook.addWorksheet(name);
        sheet.columns = [
            { header: 'Test Case ID', key: 'id', width: 15 },
            { header: 'Module', key: 'module', width: 20 },
            { header: 'Priority', key: 'priority', width: 10 },
            { header: 'Test Name', key: 'name', width: 40 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Duration (ms)', key: 'duration', width: 15 }
        ];
        tests.forEach(t => sheet.addRow(t));
        sheet.getRow(1).font = { bold: true };
    };

    const fullWb = new ExcelJS.Workbook();
    createSheet(fullWb, 'Appium E2E Results', results);
    await fullWb.xlsx.writeFile(path.join(reportDir, 'Appium_Testing_Report.xlsx'));

    const summaryWb = new ExcelJS.Workbook();
    const sumSheet = summaryWb.addWorksheet('Summary');
    const passed = results.filter(r => r.status === 'PASSED').length;
    sumSheet.addRows([
        ['EcoTrack Appium Summary'],
        ['Total', results.length],
        ['Passed', passed],
        ['Failed', results.length - passed]
    ]);
    await summaryWb.xlsx.writeFile(path.join(reportDir, 'Summary_Report.xlsx'));

    console.log(`Professional Appium reports generated in ${reportDir}`);
}

module.exports = { generateMobileExcelReport };
