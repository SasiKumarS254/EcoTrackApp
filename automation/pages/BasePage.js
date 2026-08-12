const { until, By } = require('selenium-webdriver');
const config = require('../config/config');

class BasePage {
  constructor(driver) {
    this.driver = driver;
    this.timeout = config.timeout;

    // Common Sidebar Navigation
    this.dashboardNav = By.css('[data-tab="dashboard"]');
    this.speciesTrainerNav = By.css('[data-tab="training"]');
    this.marketplaceNav = By.css('[data-tab="marketplace"]');
    this.communityNav = By.css('[data-tab="community"]');
    this.servicesNav = By.css('[data-tab="maps"]');
    this.profileNav = By.css('[data-tab="profile"]');
  }

  async open(path = '') {
    await this.driver.get(`${config.baseUrl}${path}`);
    await this.driver.manage().window().maximize();
  }

  async waitForElement(locator) {
    return await this.driver.wait(until.elementLocated(locator), this.timeout);
  }

  async waitForClickable(locator) {
    const element = await this.waitForElement(locator);
    return await this.driver.wait(until.elementIsEnabled(element), this.timeout);
  }

  async click(locator) {
    let retries = 3;
    while (retries > 0) {
      try {
        const element = await this.waitForClickable(locator);
        await this.driver.wait(until.elementIsVisible(element), this.timeout);
        await element.click();
        return;
      } catch (e) {
        if (e.name === 'StaleElementReferenceError' || e.name === 'ElementClickInterceptedError') {
          retries--;
          await this.driver.sleep(1000);
        } else {
          throw e;
        }
      }
    }
    throw new Error(`Failed to click element after retries: ${locator}`);
  }

  async type(locator, text) {
    const element = await this.waitForElement(locator);
    await element.clear();
    await element.sendKeys(text);
  }

  async getText(locator) {
    const element = await this.waitForElement(locator);
    return await element.getText();
  }

  async isVisible(locator) {
    try {
      const element = await this.waitForElement(locator);
      return await element.isDisplayed();
    } catch (e) {
      return false;
    }
  }

  async takeScreenshot(name) {
    const data = await this.driver.takeScreenshot();
    const fs = require('fs');
    const path = require('path');
    const screenshotPath = path.join(__dirname, '../screenshots', `${name}_${Date.now()}.png`);
    fs.writeFileSync(screenshotPath, data, 'base64');
    return screenshotPath;
  }
}

module.exports = BasePage;
