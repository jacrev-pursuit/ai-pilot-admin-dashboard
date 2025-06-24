// Jest setup file - runs before all tests
const { TextEncoder, TextDecoder } = require('util');

// Set up global polyfills
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Set up fetch polyfill for tests that might need it
global.fetch = global.fetch || jest.fn();