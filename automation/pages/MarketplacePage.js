const { By } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class MarketplacePage extends BasePage {
  constructor(driver) {
    super(driver);
    this.searchBar = By.id('marketplaceSearch');
    this.newListingBtn = By.css('button[onclick="openAddListingModal()"]');
    this.cartBtn = By.css('button[onclick="showCartModal()"]');
    this.animalsTab = By.id('mtab-animals');
    this.productsTab = By.id('mtab-products');

    // Listing modal locators
    this.listingTitle = By.id('listingTitle');
    this.listingPrice = By.id('listingPrice');
    this.listingLocation = By.id('listingLocation');
    this.submitListingBtn = By.css('#addListingModal .btn-primary');
  }

  async search(query) {
    await this.type(this.searchBar, query);
  }

  async createListing(title, price, location) {
    await this.click(this.newListingBtn);
    await this.type(this.listingTitle, title);
    await this.type(this.listingPrice, price);
    await this.type(this.listingLocation, location);
    await this.click(this.submitListingBtn);
  }

  async switchToProducts() {
    await this.click(this.productsTab);
  }
}

module.exports = MarketplacePage;
