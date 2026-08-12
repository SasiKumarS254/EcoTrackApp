const { expect } = require('chai');
const { createMobileDriver } = require('../utils/driver');
const Gestures = require('../utils/gestures');

describe('Android Hardware Gestures & UI Interactions', function() {
    this.timeout(180000);
    let driver;

    before(async function() {
        driver = await createMobileDriver();
        global.driver = driver;
    });

    after(async function() {
        if (driver && !driver.isMock) await driver.deleteSession();
    });

    it('Should perform a complex swipe up sequence to scroll feed', async function() {
        await Gestures.swipeUp(0.6);
        await Gestures.swipeUp(0.4);
    });

    it('Should simulate a long press on the dashboard profile icon', async function() {
        await Gestures.longPressAt(100, 100);
    });

    it('Should navigate back using Android system back gesture', async function() {
        await Gestures.androidBack();
    });
});
