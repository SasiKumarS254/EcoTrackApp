const fs = require('fs');
const path = require('path');

function generateHtmlDashboard(results) {
    const passed = results.filter(t => t.status === 'PASSED').length;
    const failed = results.filter(t => t.status === 'FAILED').length;
    const blocked = results.filter(t => t.status === 'BLOCKED').length;
    const passRate = results.length > 0 ? ((passed / results.length) * 100).toFixed(2) : '0.00';

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>EcoTrack Automation Dashboard</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            :root { --primary-eco: #10b981; --secondary-eco: #059669; }
            body { background-color: #f8fafc; font-family: 'Inter', sans-serif; }
            .header-banner { background: linear-gradient(135deg, var(--primary-eco), var(--secondary-eco)); color: white; padding: 2rem 0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
            .stat-card { border: none; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); transition: transform 0.2s; }
            .stat-card:hover { transform: translateY(-5px); }
            .status-badge { font-weight: 800; border-radius: 20px; padding: 4px 12px; }
            .status-PASSED { background-color: #dcfce7; color: #15803d; }
            .status-FAILED { background-color: #fee2e2; color: #b91c1c; }
            .status-BLOCKED { background-color: #fef3c7; color: #92400e; }
            .table-container { background: white; border-radius: 16px; padding: 20px; margin-top: 30px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
        </style>
    </head>
    <body>
        <div class="header-banner text-center mb-5">
            <h1><i class="fas fa-leaf"></i> EcoTrack Quality Assurance Dashboard</h1>
            <p class="opacity-75">Automated End-to-End Testing Reports</p>
        </div>

        <div class="container">
            <div class="row g-4 text-center">
                <div class="col-md-3">
                    <div class="card stat-card p-3">
                        <h6 class="text-muted text-uppercase">Total Executed</h6>
                        <h2 class="fw-bold">${results.length}</h2>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stat-card p-3 border-start border-success border-5">
                        <h6 class="text-muted text-uppercase">Passed</h6>
                        <h2 class="fw-bold text-success">${passed}</h2>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stat-card p-3 border-start border-danger border-5">
                        <h6 class="text-muted text-uppercase">Failed</h6>
                        <h2 class="fw-bold text-danger">${failed}</h2>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stat-card p-3 border-start border-warning border-5">
                        <h6 class="text-muted text-uppercase">Pass Rate</h6>
                        <h2 class="fw-bold text-primary">${passRate}%</h2>
                    </div>
                </div>
            </div>

            <div class="table-container">
                <h4 class="mb-4"><i class="fas fa-list-check"></i> Execution Logs</h4>
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead class="table-light">
                            <tr><th>ID</th><th>Module</th><th>Test Case</th><th>Status</th><th>Time</th><th>Evidence</th></tr>
                        </thead>
                        <tbody>
                            ${results.map(t => `
                                <tr>
                                    <td><strong>${t.id}</strong></td>
                                    <td><span class="badge bg-secondary text-white">${t.module}</span></td>
                                    <td>${t.name}</td>
                                    <td><span class="status-badge status-${t.status}">${t.status}</span></td>
                                    <td>${t.duration}ms</td>
                                    <td>${t.evidence && t.evidence.endsWith('.png') ? `<a href="../screenshots/${path.basename(t.evidence)}" target="_blank"><i class="fas fa-camera"></i></a>` : '<i class="fas fa-check text-muted"></i>'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <footer class="mt-5 py-4 text-center text-muted border-top">
            Generated on ${new Date().toLocaleString()} | EcoTrack Automated Pipeline v3.0
        </footer>
    </body>
    </html>
    `;

    const reportDir = path.join(__dirname, '../reports/HTML');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

    const reportPath = path.join(reportDir, 'execution-report.html');
    fs.writeFileSync(reportPath, html);
    console.log(`Professional HTML Dashboard generated: ${reportPath}`);
}

module.exports = { generateHtmlDashboard };
