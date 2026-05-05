import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './mocks/server';

/**
 * Test Setup Configuration
 *
 * MANDATORY: 90%+ test coverage requirement enforcement
 * Configures testing environment for enterprise-grade quality standards
 */

// Configure test environment
beforeAll(() => {
  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.CONVEX_URL = 'http://localhost:3210';
  process.env.SKIP_AUTH = 'true';

  // Start MSW server for API mocking
  server.listen({
    onUnhandledRequest: 'warn'
  });

  // Configure global test timeouts
  vitest.setConfig({
    testTimeout: 10000,
    hookTimeout: 10000
  });

  // Mock browser APIs not available in test environment
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  });

  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock
  });

  // Mock fetch for unhandled requests
  global.fetch = vi.fn();

  // Mock console methods to reduce noise in tests
  const originalError = console.error;
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  // Mock URL constructor for test environment
  global.URL = class URL {
    constructor(url: string, base?: string) {
      this.href = url;
      this.origin = 'http://localhost:5173';
      this.protocol = 'http:';
      this.host = 'localhost:5173';
      this.hostname = 'localhost';
      this.port = '5173';
      this.pathname = new globalThis.URL(url, base).pathname;
      this.search = new globalThis.URL(url, base).search;
      this.hash = new globalThis.URL(url, base).hash;
    }
    href: string;
    origin: string;
    protocol: string;
    host: string;
    hostname: string;
    port: string;
    pathname: string;
    search: string;
    hash: string;
    toString() { return this.href; }
  };
});

// Cleanup after each test
afterEach(() => {
  // Clean up React Testing Library
  cleanup();

  // Reset all mocks
  vi.clearAllMocks();

  // Reset MSW handlers
  server.resetHandlers();

  // Clear localStorage and sessionStorage
  window.localStorage.clear();
  window.sessionStorage.clear();

  // Reset fetch mock
  if (global.fetch) {
    vi.mocked(global.fetch).mockClear();
  }
});

// Global cleanup after all tests
afterAll(() => {
  // Stop MSW server
  server.close();

  // Restore console methods
  vi.restoreAllMocks();
});

// Global test utilities
global.createMockVideo = (overrides = {}) => ({
  id: 'test-video-id',
  title: 'Test Video',
  description: 'Test Description',
  youtubeUrl: 'https://youtube.com/watch?v=test',
  status: 'completed',
  userId: 'test-user-id',
  createdAt: Date.now(),
  transcriptId: 'test-transcript-id',
  ...overrides
});

global.createMockTranscript = (overrides = {}) => ({
  id: 'test-transcript-id',
  text: 'This is a test transcript',
  videoId: 'test-video-id',
  words: [
    { text: 'This', start: 0, end: 300 },
    { text: 'is', start: 400, end: 600 },
    { text: 'a', start: 700, end: 850 },
    { text: 'test', start: 950, end: 1300 },
    { text: 'transcript', start: 1400, end: 2100 }
  ],
  createdAt: Date.now(),
  ...overrides
});

global.createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  clerkId: 'clerk-test-id',
  createdAt: Date.now(),
  ...overrides
});

// Custom matchers for testing
expect.extend({
  toBeValidVideo(received) {
    const pass = received &&
      typeof received.id === 'string' &&
      typeof received.title === 'string' &&
      typeof received.userId === 'string' &&
      ['processing', 'completed', 'failed'].includes(received.status);

    return {
      message: () =>
        pass
          ? `expected ${received} not to be a valid video`
          : `expected ${received} to be a valid video`,
      pass,
    };
  },

  toBeValidTranscript(received) {
    const pass = received &&
      typeof received.id === 'string' &&
      typeof received.text === 'string' &&
      typeof received.videoId === 'string' &&
      Array.isArray(received.words);

    return {
      message: () =>
        pass
          ? `expected ${received} not to be a valid transcript`
          : `expected ${received} to be a valid transcript`,
      pass,
    };
  },

  toBeValidUser(received) {
    const pass = received &&
      typeof received.id === 'string' &&
      typeof received.email === 'string' &&
      typeof received.name === 'string';

    return {
      message: () =>
        pass
          ? `expected ${received} not to be a valid user`
          : `expected ${received} to be a valid user`,
      pass,
    };
  },

  toHaveCoverage(received, minimum = 90) {
    const pass = received >= minimum;
    return {
      message: () =>
        pass
          ? `expected coverage ${received}% not to be at least ${minimum}%`
          : `expected coverage ${received}% to be at least ${minimum}%`,
      pass,
    };
  }
});

// Type declarations for custom matchers
declare global {
  namespace Vi {
    interface JestAssertion<T = any> {
      toBeValidVideo(): T;
      toBeValidTranscript(): T;
      toBeValidUser(): T;
      toHaveCoverage(minimum?: number): T;
    }
  }

  var createMockVideo: (overrides?: any) => any;
  var createMockTranscript: (overrides?: any) => any;
  var createMockUser: (overrides?: any) => any;
}

export {};