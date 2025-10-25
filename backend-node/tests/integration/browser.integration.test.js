import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { jest } from '@jest/globals';
import app from '../../server.js';
import User from '../../models/user.model.js';

// Mock dockerode for integration tests
const mockContainer = {
  start: jest.fn().mockResolvedValue({}),
  stop: jest.fn().mockResolvedValue({}),
  remove: jest.fn().mockResolvedValue({}),
  inspect: jest.fn().mockResolvedValue({
    Id: 'test-container-id',
    State: {
      Status: 'running',
      Running: true,
      StartedAt: new Date().toISOString()
    }
  })
};

const mockDocker = {
  createContainer: jest.fn().mockResolvedValue(mockContainer),
  getContainer: jest.fn().mockReturnValue(mockContainer),
  info: jest.fn().mockResolvedValue({
    Containers: 10,
    Images: 5,
    Driver: 'overlay2',
    KernelVersion: '5.4.0',
    OperatingSystem: 'Ubuntu 20.04'
  })
};

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => mockDocker);
});

describe('Browser Integration Tests', () => {
  let mongoServer;
  let authToken;
  let userId;

  beforeAll(async () => {
    // Create in-memory MongoDB instance for testing
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Disconnect from any existing connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    // Connect to test database
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    // Clean up
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clean database and reset mocks before each test
    await User.deleteMany({});
    jest.clearAllMocks();
    
    // Create and authenticate a test user
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    };

    const signUpResponse = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(userData);

    authToken = signUpResponse.body.data.token;
    userId = signUpResponse.body.data.user.id;
  });

  describe('Complete Browser Session Workflow', () => {
    it('should handle complete browser session lifecycle', async () => {
      // Step 1: Start browser session
      const startResponse = await request(app)
        .post('/api/v1/browser/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://example.com' })
        .expect(201);

      expect(startResponse.body.success).toBe(true);
      expect(startResponse.body.data.sessionId).toBeDefined();
      expect(startResponse.body.data.browserUrl).toBeDefined();
      expect(startResponse.body.data.status).toBe('running');

      const sessionId = startResponse.body.data.sessionId;

      // Verify Docker container was created
      expect(mockDocker.createContainer).toHaveBeenCalledTimes(1);
      expect(mockContainer.start).toHaveBeenCalledTimes(1);

      // Step 2: Get session status
      const statusResponse = await request(app)
        .get(`/api/v1/browser/status/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.sessionId).toBe(sessionId);
      expect(statusResponse.body.data.userId).toBe(userId);

      // Step 3: Extend session
      const extendResponse = await request(app)
        .post('/api/v1/browser/extend')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ sessionId, extraMinutes: 10 })
        .expect(200);

      expect(extendResponse.body.success).toBe(true);
      expect(extendResponse.body.data.sessionId).toBe(sessionId);

      // Step 4: List active sessions
      const sessionsResponse = await request(app)
        .get('/api/v1/browser/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(sessionsResponse.body.success).toBe(true);
      expect(sessionsResponse.body.data.count).toBeGreaterThan(0);

      // Step 5: Stop session
      const stopResponse = await request(app)
        .post('/api/v1/browser/stop')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ sessionId })
        .expect(200);

      expect(stopResponse.body.success).toBe(true);
      expect(mockContainer.stop).toHaveBeenCalledTimes(1);
      expect(mockContainer.remove).toHaveBeenCalledTimes(1);
    });

    it('should start browser session without URL parameter', async () => {
      const startResponse = await request(app)
        .post('/api/v1/browser/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}) // No URL provided
        .expect(201);

      expect(startResponse.body.success).toBe(true);
      expect(startResponse.body.data.sessionId).toBeDefined();
      expect(startResponse.body.data.browserUrl).toBeDefined();
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all browser endpoints', async () => {
      const endpoints = [
        { method: 'post', path: '/api/v1/browser/start', body: {} },
        { method: 'post', path: '/api/v1/browser/stop', body: { sessionId: 'test' } },
        { method: 'post', path: '/api/v1/browser/extend', body: { sessionId: 'test' } },
        { method: 'get', path: '/api/v1/browser/status/test' },
        { method: 'get', path: '/api/v1/browser/sessions' },
        { method: 'post', path: '/api/v1/browser/cleanup', body: {} }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .send(endpoint.body || {})
          .expect(401);

        expect(response.body.message).toContain('Unauthorized');
      }
    });

    it('should reject invalid JWT tokens', async () => {
      const response = await request(app)
        .post('/api/v1/browser/start')
        .set('Authorization', 'Bearer invalid-token')
        .send({})
        .expect(401);

      expect(response.body.message).toContain('Unauthorized');
    });

    it('should prevent users from accessing other users sessions', async () => {
      // Create a second user
      const userData2 = {
        name: 'Test User 2',
        email: 'test2@example.com',
        password: 'password123'
      };

      const signUpResponse2 = await request(app)
        .post('/api/v1/auth/sign-up')
        .send(userData2);

      const authToken2 = signUpResponse2.body.data.token;

      // User 1 starts a session
      const startResponse = await request(app)
        .post('/api/v1/browser/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://example.com' })
        .expect(201);

      const sessionId = startResponse.body.data.sessionId;

      // User 2 tries to access User 1's session
      await request(app)
        .get(`/api/v1/browser/status/${sessionId}`)
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(404); // Should return not found for security

      // User 2 tries to stop User 1's session
      await request(app)
        .post('/api/v1/browser/stop')
        .set('Authorization', `Bearer ${authToken2}`)
        .send({ sessionId })
        .expect(404); // Should return not found for security
    });
  });

  describe('Error Handling', () => {
    it('should handle Docker container creation failures', async () => {
      mockDocker.createContainer.mockRejectedValueOnce(new Error('Docker daemon not running'));

      const response = await request(app)
        .post('/api/v1/browser/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://example.com' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to start browser session');
    });

    it('should handle invalid session IDs gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/browser/status/invalid-session-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should validate required fields for browser operations', async () => {
      // Missing sessionId for stop operation
      const stopResponse = await request(app)
        .post('/api/v1/browser/stop')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(stopResponse.body.success).toBe(false);
      expect(stopResponse.body.message).toContain('required');

      // Missing sessionId for extend operation
      const extendResponse = await request(app)
        .post('/api/v1/browser/extend')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(extendResponse.body.success).toBe(false);
      expect(extendResponse.body.message).toContain('required');
    });
  });

  describe('Session Management', () => {
    it('should track multiple concurrent sessions per user', async () => {
      // Start multiple sessions
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/v1/browser/start')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ url: `https://example${i}.com` })
          .expect(201);

        sessions.push(response.body.data.sessionId);
      }

      // Check that all sessions are listed
      const sessionsResponse = await request(app)
        .get('/api/v1/browser/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(sessionsResponse.body.data.count).toBe(3);
      
      // Stop all sessions
      for (const sessionId of sessions) {
        await request(app)
          .post('/api/v1/browser/stop')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ sessionId })
          .expect(200);
      }
    });

    it('should handle session cleanup', async () => {
      const response = await request(app)
        .post('/api/v1/browser/cleanup')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.cleanedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Browser URL Generation', () => {
    it('should generate correct URLs for development environment', async () => {
      process.env.NODE_ENV = 'development';
      
      const response = await request(app)
        .post('/api/v1/browser/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://example.com' })
        .expect(201);

      expect(response.body.data.browserUrl).toMatch(/^http:\/\/browser-session_[a-f0-9]{8}\.localhost$/);
    });

    it('should generate correct URLs for production environment', async () => {
      process.env.NODE_ENV = 'production';
      
      const response = await request(app)
        .post('/api/v1/browser/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://example.com' })
        .expect(201);

      expect(response.body.data.browserUrl).toMatch(/^https:\/\/browser-session_[a-f0-9]{8}\.disposable-services\.duckdns\.org$/);
      
      // Reset for other tests
      process.env.NODE_ENV = 'test';
    });
  });
});