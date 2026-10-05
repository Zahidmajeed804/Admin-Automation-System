import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    // Default 5s is tight for tests that drive the calendar DatePicker across
    // several months (see src/test/datePicker.js) under full-suite CPU load.
    testTimeout: 15000,
  },
});
