const BaseScreen = require('./BaseScreen');

class LoginScreen extends BaseScreen {
    get emailInput() { return 'accessibility id:Email Input'; }
    get passwordInput() { return 'accessibility id:Password Input'; }
    get loginButton() { return 'accessibility id:Login Button'; }
    get errorMessage() { return 'accessibility id:Error Message'; }

    async login(email, password) {
        await this.type(this.emailInput, email);
        await this.type(this.passwordInput, password);
        await this.click(this.loginButton);
    }
}

module.exports = new LoginScreen();
