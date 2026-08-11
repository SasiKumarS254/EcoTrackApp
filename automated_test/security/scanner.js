const axios = require('axios');
const fs = require('fs');
const path = require('path');

const inputConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'input.json'), 'utf8'));
const BASE_URL = process.env.API_BASE_URL || inputConfig.baseUrl;

async function runSecurityScan() {
    console.log(`🛡️ EcoTrack DAST Scanner: Targetting ${BASE_URL}...`);
    const findings = [];

    const targets = [
        { path: '/auth/login', methods: ['POST'], auth: false, cat: 'Authentication' },
        { path: '/community', methods: ['GET', 'POST'], auth: true, cat: 'Social' },
        { path: '/marketplace', methods: ['GET'], auth: false, cat: 'Commerce' },
        { path: '/encyclopedia/search', methods: ['GET'], auth: false, cat: 'Data' },
        { path: '/users/1', methods: ['GET', 'PUT'], auth: true, cat: 'RBAC' },
        { path: '/scans/reports', methods: ['GET'], auth: true, cat: 'AI' }
    ];

    for (const ep of targets) {
        for (const method of ep.methods) {
            console.log(`[DAST] Testing ${method} ${ep.path}...`);
            const start = Date.now();

            try {
                // 1. Basic Readiness Check
                const res = await axios({
                    method,
                    url: `${BASE_URL}${ep.path}`,
                    validateStatus: () => true,
                    timeout: 5000
                });

                // 2. Security Headers Audit
                const headers = res.headers;
                if (!headers['content-security-policy']) findings.push({ endpoint: ep.path, finding: 'Missing CSP Header', severity: 'High' });
                if (!headers['x-frame-options']) findings.push({ endpoint: ep.path, finding: 'Missing X-Frame-Options (Clickjacking Risk)', severity: 'Medium' });

                // 3. Unauthorized Access Probe
                if (ep.auth && res.status !== 401 && res.status !== 403) {
                    findings.push({ endpoint: ep.path, finding: 'Auth required but endpoint returned success/non-auth status', severity: 'Critical' });
                }

                // 4. IDOR (Insecure Direct Object Reference) Probe
                if (ep.path.includes('/users/') || ep.path.includes('/reports/')) {
                    const idorRes = await axios.get(`${BASE_URL}${ep.path.replace('1', '999999')}`, { validateStatus: () => true });
                    if (idorRes.status === 200) findings.push({ endpoint: ep.path, finding: 'Potential IDOR: Accessing arbitrary ID success', severity: 'Critical' });
                }

                // 5. JWT Tampering & Manipulation
                if (inputConfig.authTokens && inputConfig.authTokens.user) {
                    const parts = inputConfig.authTokens.user.split('.');
                    if (parts.length === 3) {
                        // Attempt to modify payload without resigning
                        const tamperedPayload = Buffer.from(JSON.stringify({ role: 'admin', id: '1' })).toString('base64').replace(/=/g, '');
                        const tamperedJwt = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
                        const jwtRes = await axios.get(`${BASE_URL}${ep.path}`, {
                            headers: { 'Authorization': `Bearer ${tamperedJwt}` },
                            validateStatus: () => true
                        });
                        if (jwtRes.status === 200) findings.push({ endpoint: ep.path, finding: 'JWT manipulation accepted (Lack of signature verification)', severity: 'Critical' });
                    }
                }

                findings.push({
                    endpoint: ep.path,
                    method,
                    status: res.status,
                    responseTime: Date.now() - start,
                    category: ep.cat,
                    timestamp: new Date().toISOString()
                });

            } catch (err) {
                findings.push({ endpoint: ep.path, method, error: err.message, status: 'BLOCKED', severity: 'High' });
            }
        }
    }

    const reportDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, 'security_report.json'), JSON.stringify(findings, null, 2));

    console.log(`✅ DAST Scan complete. Findings: ${findings.length}`);
}

runSecurityScan();
