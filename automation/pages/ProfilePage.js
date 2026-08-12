const { By } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class ProfilePage extends BasePage {
    constructor(driver) {
        super(driver);
        this.heroName = By.id('profileHeroName');
        this.editBtn = By.css('button[onclick="openEditProfileModal()"]');
        this.addPetBtn = By.css('button[onclick="openAddPetModal()"]');

        // Edit Profile locators
        this.editNameInput = By.id('editProfileName');
        this.editBioInput = By.id('editProfileBio');
        this.saveProfileBtn = By.id('editProfileSaveBtn');

        // Pet Vault
        this.petsGrid = By.id('profileTabContentArea');
    }

    async getProfileName() {
        return await this.getText(this.heroName);
    }

    async updateBio(newBio) {
        await this.click(this.editBtn);
        await this.type(this.editBioInput, newBio);
        await this.click(this.saveProfileBtn);
    }

    async addPet(name, species) {
        await this.click(this.addPetBtn);
        await this.type(By.id('petName'), name);
        await this.type(By.id('petSpecies'), species);
        await this.click(By.css('button[onclick="submitAddPet()"]'));
    }
}

module.exports = ProfilePage;
