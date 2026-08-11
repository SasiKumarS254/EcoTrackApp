const BaseScreen = require('./BaseScreen');

class MarketplaceScreen extends BaseScreen {
    get searchInput() { return 'accessibility id:Marketplace Search'; }
    get newListingBtn() { return 'accessibility id:Create Listing Button'; }
    get firstItemCard() { return 'accessibility id:Market Item 0'; }

    async searchForItem(query) {
        await this.type(this.searchInput, query);
    }
}

module.exports = new MarketplaceScreen();
