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

    async longPressAt(x, y, duration = 2000) {
        await driver.action('pointer')
            .move({ duration: 0, x, y })
            .down({ button: 0 })
            .pause(duration)
            .up({ button: 0 })
            .perform();
    }

    async swipeLeft(percentage = 0.5) {
        const windowSize = await driver.getWindowSize();
        const y = windowSize.height / 2;
        const xStart = windowSize.width * 0.9;
        const xEnd = windowSize.width * (0.9 - percentage);

        await driver.action('pointer')
            .move({ duration: 0, x: xStart, y })
            .down({ button: 0 })
            .move({ duration: 600, x: xEnd, y })
            .up({ button: 0 })
            .perform();
    }

    async androidBack() {
        await driver.back();
    }
}

module.exports = new Gestures();
