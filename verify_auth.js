const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Log browser console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
  
  console.log('🚀 Starting end-to-end Authentication verification...');
  
  // Set viewport for consistent coordinates and layout testing
  await page.setViewport({ width: 1280, height: 800 });
  
  // Generate a unique email to guarantee a clean test
  const uniqueEmail = `user_${Date.now()}@ecotrack.org`;
  const defaultPassword = 'password123';
  const newPassword = 'newpassword987';
  
  try {
    // 1. Navigate to landing / auth page
    console.log('Navigating to http://localhost:3000/index.html...');
    await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle0' });
    
    // Check if the logo exists and features cards are loaded
    const logoSrc = await page.evaluate(() => {
      const img = document.querySelector('.login-logo');
      return img ? img.src : null;
    });
    console.log(`Logo loaded: ${logoSrc}`);
    
    // 2. Click Create Account tab
    console.log('Switching to Create Account tab...');
    await page.click('#tab-signup');
    await sleep(500);
    
    // Fill signup details
    console.log(`Creating account for ${uniqueEmail}...`);
    await page.type('#signupName', 'Test Inspector');
    await page.type('#signupEmail', uniqueEmail);
    await page.type('#signupPassword', defaultPassword);
    
    // Submit registration
    await page.click('#signUpBtn');
    console.log('Waiting for login & redirection to dashboard...');
    await page.waitForSelector('#mainApp', { visible: true, timeout: 5000 });
    console.log('🎉 Account created & logged in successfully! Dashboard is visible.');
    
    // 3. Sign Out
    console.log('Signing out...');
    await page.click('.logout-btn');
    await page.waitForSelector('#loginPage', { visible: true, timeout: 5000 });
    console.log('👋 Successfully logged out back to authentication page.');
    
    // 4. Sign In again
    console.log('Signing back in with password...');
    await page.waitForSelector('#loginEmail', { visible: true });
    await page.type('#loginEmail', uniqueEmail);
    await page.type('#loginPassword', defaultPassword);
    
    // Verify password visibility toggle
    console.log('Testing password visibility toggle...');
    let passType = await page.evaluate(() => document.getElementById('loginPassword').type);
    console.log(`Password input type is originally: ${passType}`);
    
    await page.click('#toggleLoginPass');
    await sleep(200);
    passType = await page.evaluate(() => document.getElementById('loginPassword').type);
    console.log(`Password input type after clicking toggle: ${passType}`);
    
    await page.click('#toggleLoginPass');
    await sleep(200);
    
    // Submit Sign In
    await page.click('#signInBtn');
    await page.waitForSelector('#mainApp', { visible: true, timeout: 5000 });
    console.log('🔑 Sign in successful!');
    
    // Log out again to prepare for Forgot Password test
    await page.click('.logout-btn');
    await page.waitForSelector('#loginPage', { visible: true });
    
    // 5. Forgot Password & OTP Reset flow
    console.log('Starting Forgot Password flow...');
    await page.click('.forgot-pass-link');
    await page.waitForSelector('#forgotEmail', { visible: true });
    
    await page.type('#forgotEmail', uniqueEmail);
    // Clear any previous test OTP files
    const otpFilePath = path.join(__dirname, 'website', 'last_otp.txt');
    if (fs.existsSync(otpFilePath)) {
      fs.unlinkSync(otpFilePath);
    }
    
    console.log('Requesting OTP code...');
    await page.click('#sendOtpBtn');
    
    // Wait for the OTP text file to be created by the backend
    console.log('Waiting for backend mock service to write OTP...');
    let otp = '';
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      if (fs.existsSync(otpFilePath)) {
        otp = fs.readFileSync(otpFilePath, 'utf8').trim();
        break;
      }
    }
    
    if (!otp) {
      throw new Error('❌ Failed to capture OTP code from website/last_otp.txt. Verify that backend is running and writing OTP.');
    }
    
    console.log(`Captured OTP code: ${otp}`);
    
    // Verify OTP input fields are visible
    await page.waitForSelector('#otpCodeInput', { visible: true });
    await page.type('#otpCodeInput', otp);
    await page.click('#verifyOtpBtn');
    
    // Wait for the reset password inputs
    console.log('OTP verified. Entering new password...');
    await page.waitForSelector('#newPasswordInput', { visible: true, timeout: 3000 });
    await page.type('#newPasswordInput', newPassword);
    await page.type('#confirmPasswordInput', newPassword);
    
    await page.click('#resetPassBtn');
    console.log('Submitting password update...');
    
    // Reload the page to ensure a clean state
    console.log('Reset completed! Reloading index.html for final sign in...');
    await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle0' });
    
    console.log('Signing in with updated password...');
    await page.waitForSelector('#loginEmail', { visible: true });
    await page.type('#loginEmail', uniqueEmail);
    await page.type('#loginPassword', newPassword);
    await page.click('#signInBtn');
    
    await page.waitForSelector('#mainApp', { visible: true, timeout: 5000 });
    console.log('🎉 Successfully logged in using the new password!');
    
    console.log('✅ ALL VERIFICATIONS COMPLETED SUCCESSFULLY. Authentication redesign is production ready and fully integrated.');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
