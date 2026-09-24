/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  transform: {},
  globalSetup: "<rootDir>/tests/globalSetup.js",
  globalTeardown: "<rootDir>/tests/globalTeardown.js",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  testTimeout: 20000,
  // Only used by `npm run test:coverage`. v8 because there is no Babel step to instrument ESM.
  coverageProvider: "v8",
  collectCoverageFrom: ["src/**/*.js", "!src/server.js"], // server.js only starts the listener
  coverageDirectory: "coverage",
  verbose: true,
};
