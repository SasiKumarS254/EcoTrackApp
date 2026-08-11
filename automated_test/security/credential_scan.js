const fs = require('fs');
const path = require('path');

const SENSITIVE_PATTERNS = [
    /["']?password["']?\s*[:=]\s*["'](.*?)["']/gi,
    /["']?secret["']?\s*[:=]\s*["'](.*?)["']/gi,
    /["']?apikey["']?\s*[:=]\s*["'](.*?)["']/gi,
    /["']?token["']?\s*[:=]\s*["'](.*?)["']/gi,
    /AIza[0-9A-Za-z-_]{35}/g, // Google API Key
    /sq0atp-[0-9A-Za-z-_]{22}/g, // Square Access Token
    /sk_live_[0-9a-zA-Z]{24}/g, // Stripe Live Key
];

const EXCLUDED_DIRS = ['node_modules', '.git', 'reports', 'screenshots', 'logs', 'venv'];
const EXCLUDED_FILES = ['package-lock.json', 'last_otp.txt', 'input.json'];

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const findings = [];

    SENSITIVE_PATTERNS.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            // Basic heuristic to avoid false positives (like empty strings or placeholders)
            if (match[1] && match[1].length > 3 && !match[1].includes('placeholder')) {
                findings.push({
                    file: filePath,
                    line: content.substring(0, match.index).split('\n').length,
                    pattern: pattern.toString(),
                    value: '***REDACTED***'
                });
            }
        }
    });
    return findings;
}

function walkDir(dir, allFindings) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            if (!EXCLUDED_DIRS.includes(file)) {
                walkDir(filePath, allFindings);
            }
        } else {
            if (!EXCLUDED_FILES.includes(file) && (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.html') || file.endsWith('.json'))) {
                const fileFindings = scanFile(filePath);
                if (fileFindings.length > 0) {
                    allFindings.push(...fileFindings);
                }
            }
        }
    });
}

console.log('🛡️ Starting Codebase Credential Scan...');
const totalFindings = [];
walkDir(path.join(__dirname, '../../'), totalFindings);

const reportPath = path.join(__dirname, 'reports/credential_findings.json');
fs.writeFileSync(reportPath, JSON.stringify(totalFindings, null, 2));

if (totalFindings.length > 0) {
    console.warn(`⚠️  Found ${totalFindings.length} potential hardcoded credentials!`);
} else {
    console.log('✅ No hardcoded credentials detected in codebase.');
}
