import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../server.js';

describe('Health Endpoint', () => {
  let mongoServer;

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

  describe('GET /api/v1/health', () => {
    it('should return healthy status when all systems are operational', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'safebox-backend',
        database: 'connected'
      });

      // Check required fields
      expect(response.body.timestamp).toBeDefined();
      expect(typeof response.body.timestamp).toBe('string');
      expect(response.body.version).toBeDefined();
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThan(0);
      expect(response.body.environment).toBeDefined();
      
      // Check memory information
      expect(response.body.memory).toBeDefined();
      expect(typeof response.body.memory.used).toBe('number');
      expect(typeof response.body.memory.total).toBe('number');
      expect(typeof response.body.memory.external).toBe('number');
      expect(response.body.memory.used).toBeGreaterThan(0);
      expect(response.body.memory.total).toBeGreaterThan(0);
      
      // Check session manager status
      expect(response.body.sessionManager).toBeDefined();
      expect(typeof response.body.sessionManager.isRunning).toBe('boolean');
      expect(typeof response.body.sessionManager.hasInterval).toBe('boolean');
    });

    it('should return degraded status when database is disconnected', async () => {
      // Disconnect from database
      await mongoose.disconnect();
      
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.status).toBe('degraded');
      expect(response.body.database).toBe('disconnected');
      
      // Reconnect for other tests
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
    });

    it('should include correct service information', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.service).toBe('safebox-backend');
      expect(response.body.environment).toBeDefined();
      expect(['development', 'test', 'production']).toContain(response.body.environment);
    });

    it('should include memory usage statistics', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      const { memory } = response.body;
      
      // Memory values should be reasonable (in MB)
      expect(memory.used).toBeGreaterThan(0);
      expect(memory.used).toBeLessThan(1000); // Less than 1GB for tests
      expect(memory.total).toBeGreaterThan(memory.used);
      expect(memory.external).toBeGreaterThanOrEqual(0);
      
      // Values should be properly rounded to 2 decimal places
      expect(memory.used % 1).toBeLessThanOrEqual(0.01);
      expect(memory.total % 1).toBeLessThanOrEqual(0.01);
      expect(memory.external % 1).toBeLessThanOrEqual(0.01);
    });

    it('should include uptime information', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThan(0);
      expect(response.body.uptime).toBeLessThan(3600); // Less than 1 hour for tests
    });

    it('should include session manager status', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      const { sessionManager } = response.body;
      
      expect(typeof sessionManager.isRunning).toBe('boolean');
      expect(typeof sessionManager.hasInterval).toBe('boolean');
      
      // In test environment, session manager should be running
      expect(sessionManager.isRunning).toBe(true);
      expect(sessionManager.hasInterval).toBe(true);
    });

    it('should include valid timestamp in ISO format', async () => {
      const beforeRequest = new Date().toISOString();
      
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      const afterRequest = new Date().toISOString();
      
      expect(response.body.timestamp).toBeDefined();
      expect(typeof response.body.timestamp).toBe('string');
      
      // Validate ISO format
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
      
      // Timestamp should be within the request timeframe
      expect(response.body.timestamp).toBeGreaterThanOrEqual(beforeRequest);
      expect(response.body.timestamp).toBeLessThanOrEqual(afterRequest);
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, () => 
        request(app).get('/api/v1/health')
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toMatch(/^(healthy|degraded)$/);
        expect(response.body.service).toBe('safebox-backend');
      });
    });

    it('should be accessible without authentication', async () => {
      // Health endpoint should not require authentication
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.status).toBeDefined();
    });
  });

  describe('Health Check Performance', () => {
    it('should respond quickly (under 100ms)', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/v1/health')
        .expect(200);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(100);
    });

    it('should handle high load of health checks', async () => {
      const concurrentRequests = 20;
      const requests = Array.from({ length: concurrentRequests }, () => 
        request(app).get('/api/v1/health')
      );
      
      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / concurrentRequests;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Average response time should still be reasonable
      expect(avgResponseTime).toBeLessThan(200);
    });
  });
});