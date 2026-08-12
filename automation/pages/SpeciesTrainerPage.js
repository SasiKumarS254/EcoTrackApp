const { By } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class SpeciesTrainerPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.speciesInput = By.id('trainSpecies');
    this.breedInput = By.id('trainBreed');
    this.ageInput = By.id('trainAge');
    this.weightInput = By.id('trainWeight');
    this.daysInput = By.id('trainDays');
    this.goalInput = By.id('trainGoal');
    this.generateBtn = By.css('button[type="submit"]');
    this.resultContainer = By.id('trainingResultContainer');
  }

  async generatePlan(species, breed, age, weight, days, goal) {
    await this.type(this.speciesInput, species);
    await this.type(this.breedInput, breed);
    await this.type(this.ageInput, age);
    await this.type(this.weightInput, weight);
    await this.type(this.daysInput, days);
    await this.type(this.goalInput, goal);
    await this.click(this.generateBtn);
  }

  async isPlanGenerated() {
    return await this.isVisible(this.resultContainer);
  }
}

module.exports = SpeciesTrainerPage;
