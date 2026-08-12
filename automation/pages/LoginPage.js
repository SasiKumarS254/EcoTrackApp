const { By } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class LoginPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.emailInput = By.id('loginEmail');
    this.passwordInput = By.id('loginPassword');
    this.signInButton = By.id('signInBtn');
    this.createAccountTab = By.id('tab-signup');
    this.forgotPasswordLink = By.className('forgot-pass-link');

    // Sign Up locators
    this.signupName = By.id('signupName');
    this.signupEmail = By.id('signupEmail');
    this.signupPassword = By.id('signupPassword');
    this.signUpBtn = By.id('signUpBtn');
  }

  async login(email, password) {
    await this.waitForElement(this.emailInput);
    await this.type(this.emailInput, email);
    await this.type(this.passwordInput, password);
    await this.click(this.signInButton);

    // Wait for EITHER Dashboard OR Error Toast
    const result = await this.driver.wait(async (d) => {
        const title = await d.findElements(By.id('topPageTitle'));
        if (title.length > 0 && await title[0].isDisplayed()) return { success: true };

        const error = await d.findElements(By.className('toast error'));
        if (error.length > 0) {
            const text = await error[0].getText();
            return { success: false, message: text };
        }
        return false;
    }, this.timeout);

    if (!result.success) {
        throw new Error(`Login failed: ${result.message}`);
    }
  }

  async signup(name, email, password) {
    await this.click(this.createAccountTab);
    await this.type(this.signupName, name);
    await this.type(this.signupEmail, email);
    await this.type(this.signupPassword, password);
    await this.click(this.signUpBtn);
  }

  async goToForgotPassword() {
    await this.click(this.forgotPasswordLink);
  }
}

module.exports = LoginPage;
