/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  transform: {},
  globalSetup: "<rootDir>/tests/globalSetup.js",
  globalTeardown: "<rootDir>/tests/globalTeardown.js",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  testTimeout: 20000,
  verbose: true,
};
