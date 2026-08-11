class BaseScreen {
    async findElement(selector) {
        return await $(selector);
    }

    async click(selector) {
        const element = await this.findElement(selector);
        await element.waitForDisplayed();
        await element.click();
    }

    async type(selector, text) {
        const element = await this.findElement(selector);
        await element.waitForDisplayed();
        await element.setValue(text);
    }

    async getText(selector) {
        const element = await this.findElement(selector);
        await element.waitForDisplayed();
        return await element.getText();
    }
}

module.exports = BaseScreen;
