/**
 * Touch Gestures Utility for Appium Android
 */

class Gestures {
    async swipeUp(percentage = 0.5) {
        const windowSize = await driver.getWindowSize();
        const x = windowSize.width / 2;
        const yStart = windowSize.height * 0.8;
        const yEnd = windowSize.height * (0.8 - percentage);

        await driver.action('pointer')
            .move({ duration: 0, x, y: yStart })
            .down({ button: 0 })
            .move({ duration: 600, x, y: yEnd })
            .up({ button: 0 })
            .perform();
    }

    async tapAt(x, y) {
        await driver.action('pointer')
            .move({ duration: 0, x, y })
            .down({ button: 0 })
            .pause(100)
            .up({ button: 0 })
            .perform();
    }

    async androidBack() {
        await driver.back();
    }
}

module.exports = new Gestures();
