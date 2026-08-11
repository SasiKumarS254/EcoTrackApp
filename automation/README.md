# EcoTrack Automation Framework

This directory contains a robust, scalable CI/CD automation suite designed for EcoTrackApp.

## Structure
- `tests/`: Contains 4 distinct test suites (Web, Mobile, Security, Load) with 300+ cases each.
- `utils/`: Helper scripts for report generation (Excel, HTML, JSON).
- `reports/`: (Generated) Professional artifacts for stakeholders.
- `package.json`: Manages automation dependencies.

## Key Features
- **Data-Driven Tests**: Uses Jest to scale test coverage across thousands of permutations.
- **Multi-Format Reporting**: Generates interactive HTML dashboards and detailed Excel sheets.
- **CI/CD Integration**: Fully integrated with GitHub Actions for deployment and testing.

## Local Execution
To run the tests locally:
1. Navigate to the root directory.
2. Run `./scripts/run_automation.ps1` (Windows) or `npm install && npm run test:all` inside the `automation` folder.

## CI/CD Pipeline
The `.github/workflows/deploy-and-test.yml` handles:
1. Building Frontend (Expo) and Backend (Node.js).
2. Deploying the website to GitHub Pages.
3. Running the full automation suite against the live deployment.
4. Uploading reports as artifacts for 30 days.
