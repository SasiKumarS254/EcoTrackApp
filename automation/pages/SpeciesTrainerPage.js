const { By } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class SpeciesTrainerPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.speciesInput = By.css('#training #trainSpecies');
    this.breedInput = By.css('#training #trainBreed');
    this.ageInput = By.css('#training #trainAge');
    this.weightInput = By.css('#training #trainWeight');
    this.daysInput = By.css('#training #trainDays');
    this.goalInput = By.css('#training #trainGoal');
    this.generateBtn = By.css('#training button[type="submit"]');
    this.resultContainer = By.id('trainingResultContainer');
    this.planTitle = By.css('#trainingResultContainer .card-title');
    this.progressBar = By.id('trainingPlanProgressBar');
    this.drillCheckboxes = By.className('drill-checkbox');
    this.nutritionProtocols = By.xpath("//div[contains(text(), 'Nutrition Protocol')]");
  }

  async generatePlan(species, breed, age, weight, days, goal) {
    console.log(`Generating plan for ${species}...`);
    await this.type(this.speciesInput, species);
    await this.type(this.breedInput, breed);
    await this.type(this.ageInput, age.toString());
    await this.type(this.weightInput, weight.toString());
    await this.type(this.daysInput, days.toString());
    await this.type(this.goalInput, goal);
    console.log('Clicking generate button...');
    await this.click(this.generateBtn);
    console.log('Waiting for plan results...');
    await this.waitForElement(this.resultContainer);
    // Wait for title to actually have text
    await this.driver.wait(async (d) => {
        const text = await d.findElement(this.planTitle).getText();
        return text.length > 0;
    }, this.timeout);
    console.log('Plan generated and rendered.');
  }

  async getPlanTitle() {
    return await this.getText(this.planTitle);
  }

  async getPlanProgress() {
    const style = await this.driver.findElement(this.progressBar).getAttribute('style');
    const match = style.match(/width:\s*(\d+)%/);
    return match ? parseInt(match[1]) : 0;
  }

  async isPlanGenerated() {
    return await this.isVisible(this.resultContainer);
  }
}

module.exports = SpeciesTrainerPage;
