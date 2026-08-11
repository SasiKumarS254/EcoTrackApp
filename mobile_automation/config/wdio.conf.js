exports.config = {
    user: process.env.BROWSERSTACK_USERNAME || 'default_user',
    key: process.env.BROWSERSTACK_ACCESS_KEY || 'default_key',

    updateJob: false,
    specs: [
        '../tests/**/*.test.js'
    ],
    exclude: [],

    maxInstances: 1,

    capabilities: [{
        platformName: 'Android',
        'appium:deviceName': 'Android Emulator',
        'appium:automationName': 'UiAutomator2',
        'appium:app': process.env.APP_PATH || './app-release.apk',
        'appium:noReset': true,
        'appium:newCommandTimeout': 240,
    }],

    logLevel: 'info',
    bail: 0,
    baseUrl: 'http://localhost',
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,

    services: ['appium'],

    framework: 'mocha',
    reporters: ['spec', ['mochawesome', {
        outputDir: '../reports/html',
        stdout: false
    }]],

    mochaOpts: {
        ui: 'bdd',
        timeout: 120000
    },

    afterTest: async function (test, context, { error, result, duration, passed, retries }) {
        if (!passed) {
            await driver.saveScreenshot(`../screenshots/${test.title.replace(/\s+/g, '_')}.png`);
        }
    }
};
