const { By } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class SpeciesScannerPage extends BasePage {
    constructor(driver) {
        super(driver);
        this.scannerTitle = By.id('aiScannerTitle');
        this.videoElement = By.id('aiScannerVideo');
        this.canvasElement = By.id('aiScannerCanvas');
        this.startBtn = By.id('aiScannerStartBtn');
        this.statusMsg = By.id('aiScannerStatusMsg');
        this.progressBar = By.id('aiScannerProgressBar');
        this.fpsLabel = By.id('webFpsLabel');
        this.closeBtn = By.css('button[onclick="closeAiScannerModal()"]');
    }

    async isScannerActive() {
        return await this.isVisible(this.scannerTitle);
    }

    async startScan() {
        await this.click(this.startBtn);
    }

    async getScanProgress() {
        const style = await this.driver.findElement(this.progressBar).getAttribute('style');
        const match = style.match(/width:\s*(\d+)%/);
        return match ? parseInt(match[1]) : 0;
    }

    async closeScanner() {
        await this.click(this.closeBtn);
    }
}

module.exports = SpeciesScannerPage;
