require('dotenv').config();

const REPO_OWNER = process.env.REPO_OWNER || 'SasiKumarS254';
const REPO_NAME = process.env.REPO_NAME || 'EcoTrackAppTesting';

const config = {
  baseUrl: process.env.BASE_URL || (process.env.GITHUB_ACTIONS ? 'http://localhost:8080/' : `https://SasiKumarS254.github.io/EcoTrackApp/`),
  timeout: 60000,
  headless: process.env.HEADLESS !== 'false',
  browser: 'chrome'
};
console.log(`[Config] Base URL: ${config.baseUrl}`);

module.exports = config;
