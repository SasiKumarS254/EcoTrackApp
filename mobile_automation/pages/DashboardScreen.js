const BaseScreen = require('./BaseScreen');

class DashboardScreen extends BaseScreen {
    get title() { return 'accessibility id:Dashboard Title'; }
    get scannerTab() { return 'accessibility id:Scanner Tab'; }
    get marketplaceTab() { return 'accessibility id:Marketplace Tab'; }
    get communityTab() { return 'accessibility id:Community Tab'; }
    get mapsTab() { return 'accessibility id:Maps Tab'; }
    get profileTab() { return 'accessibility id:Profile Tab'; }

    async getHeaderTitle() {
        return await this.getText(this.title);
    }
}

module.exports = new DashboardScreen();
