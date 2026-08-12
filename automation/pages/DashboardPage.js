const { By } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class DashboardPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.topPageTitle = By.id('topPageTitle');
    this.speciesTrainerNav = By.css('[data-tab="training"]');
    this.marketplaceNav = By.css('[data-tab="marketplace"]');
    this.communityNav = By.css('[data-tab="community"]');
    this.profileNav = By.css('[data-tab="profile"]');
    this.logoutBtn = By.className('logout-btn');
    this.themeToggle = By.className('theme-toggle-btn');
  }

  async getTitle() {
    return await this.getText(this.topPageTitle);
  }

  async logout() {
    await this.click(this.logoutBtn);
  }

  async toggleTheme() {
    await this.click(this.themeToggle);
  }
}

module.exports = DashboardPage;
