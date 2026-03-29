import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/e2e/"],
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
};

export default createJestConfig(customJestConfig);
