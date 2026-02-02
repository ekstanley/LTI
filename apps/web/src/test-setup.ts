import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

// Mock localStorage
const storageData: Record<string, string> = {};

const localStorageMock: Storage = {
  getItem: (key: string) => storageData[key] || null,
  setItem: (key: string, value: string) => {
    storageData[key] = value;
  },
  removeItem: (key: string) => {
    delete storageData[key];
  },
  clear: () => {
    Object.keys(storageData).forEach((key) => {
      delete storageData[key];
    });
  },
  get length() {
    return Object.keys(storageData).length;
  },
  key: (index: number) => {
    const keys = Object.keys(storageData);
    return keys[index] || null;
  },
};

global.localStorage = localStorageMock;

// Clear localStorage before each test
beforeEach(() => {
  localStorageMock.clear();
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});
