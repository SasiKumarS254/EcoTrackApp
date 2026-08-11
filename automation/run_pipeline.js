const reporter = require('./shared/reporting');
const runWebTests = require('./selenium/web_tests');
const runSecurityTests = require('./security/security_tests');
const runPerformanceTests = require('./performance/performance_tests');
const runMobileTests = require('./appium/mobile_tests');

const BASE_URL = process.env.BASE_URL || 'https://sasikumars254.github.io/EcoTrackApp';

async function main() {
    console.log('====================================================');
    console.log('  ECOTRACK ENTERPRISE CI/CD PIPELINE EXECUTION      ');
    console.log('====================================================');

    try {
        await runWebTests(BASE_URL);
        await runSecurityTests(BASE_URL);
        await runPerformanceTests(BASE_URL);
        await runMobileTests();

        reporter.generateReports();

        console.log('\nPipeline Execution Finished.');
        process.exit(0);
    } catch (error) {
        console.error('Critical Pipeline Failure:', error);
        process.exit(1);
    }
}

main();
