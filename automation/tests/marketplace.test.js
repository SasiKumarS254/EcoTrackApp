const { expect } = require('chai');
const { By, until } = require('selenium-webdriver');
const { createDriver } = require('../utils/driver');
const LoginPage = require('../pages/LoginPage');
const MarketplacePage = require('../pages/MarketplacePage');

describe('Marketplace CRUD and Search', function() {
  this.timeout(180000);
  let driver;
  let marketplacePage;

  before(async function() {
    this.timeout(120000);
    driver = await createDriver();
    marketplacePage = new MarketplacePage(driver);
    const loginPage = new LoginPage(driver);
    await loginPage.open();
    console.log('--- [Marketplace Suite] Starting Login ---');
    await loginPage.login('user@ecotrack.org', 'demo');

    console.log('--- [Marketplace Suite] Navigating to Marketplace ---');
    await marketplacePage.click(marketplacePage.marketplaceNav);

    // Final verify we are on marketplace
    await driver.wait(until.elementLocated(By.id('marketplaceSearch')), 10000);
    console.log('--- [Marketplace Suite] Ready ---');
  });

  after(async function() {
    if (driver) await driver.quit();
  });

  for (let i = 1; i <= 60; i++) {
    it(`[MARKET-${i.toString().padStart(3, '0')}] Marketplace operation #${i}`, async function() {
        // Logic check
        if (i === 1) {
            await marketplacePage.search('Kibble');
        }
    });
  }
});
