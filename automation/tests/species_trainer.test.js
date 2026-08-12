const { expect } = require('chai');
const { createDriver } = require('../utils/driver');
const LoginPage = require('../pages/LoginPage');
const SpeciesTrainerPage = require('../pages/SpeciesTrainerPage');

describe('Species AI Trainer Deep Validation', function() {
    this.timeout(180000);
    let driver;
    let trainerPage;

    before(async function() {
        driver = await createDriver();
        trainerPage = new SpeciesTrainerPage(driver);
        const loginPage = new LoginPage(driver);
        await loginPage.open();
        await loginPage.login('user@ecotrack.org', 'demo');
        await trainerPage.click(trainerPage.speciesTrainerNav);
    });

    after(async function() {
        if (driver) await driver.quit();
    });

    it('Should generate and validate a full training regimen', async function() {
        // 1. Generate Plan
        await trainerPage.generatePlan('Bengal Tiger', 'Wild', 5, 200, 10, 'Muscle Gain');

        // 2. Validate Title
        const planTitle = await trainerPage.getPlanTitle();
        expect(planTitle).to.contain('10-Day AI Species-Targeted Training Protocol');
        expect(planTitle).to.contain('Bengal Tiger');

        // 3. Validate Initial Progress
        let progress = await trainerPage.getPlanProgress();
        expect(progress).to.equal(0);

        // 4. Update Progress by checking drills
        const drills = await trainerPage.driver.findElements(trainerPage.drillCheckboxes);
        expect(drills.length).to.be.above(0);

        // Use executeScript to bypass any potential overlay issues
        await trainerPage.driver.executeScript("arguments[0].click();", drills[0]);
        await trainerPage.driver.sleep(1000);

        progress = await trainerPage.getPlanProgress();
        expect(progress).to.be.above(0);

        // 5. Validate Nutrition
        const protocols = await trainerPage.driver.findElements(trainerPage.nutritionProtocols);
        expect(protocols.length).to.be.above(0);
        const text = await protocols[0].getText();
        expect(text.toLowerCase()).to.contain('nutrition protocol');
    });
});
