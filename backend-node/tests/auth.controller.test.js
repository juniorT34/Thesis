import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import app from '../server.js';
import User from '../models/user.model.js';

describe('Auth Controller', () => {
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

  beforeEach(async () => {
    // Clean database before each test
    await User.deleteMany({});
  });

  describe('POST /api/v1/auth/sign-up', () => {
    const validUserData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    };

    it('should create a new user successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/sign-up')
        .send(validUserData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('created successfully');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.name).toBe(validUserData.name);
      expect(response.body.data.user.email).toBe(validUserData.email);
      expect(response.body.data.user.role).toBe('USER');
      expect(response.body.data.user.password).toBeUndefined();

      // Verify user was created in database
      const user = await User.findOne({ email: validUserData.email });
      expect(user).toBeTruthy();
      expect(user.name).toBe(validUserData.name);
      expect(await bcrypt.compare(validUserData.password, user.password)).toBe(true);
    });

    it('should return 400 when required fields are missing', async () => {
      const testCases = [
        { name: 'Test User', email: 'test@example.com' }, // missing password
        { name: 'Test User', password: 'password123' }, // missing email
        { email: 'test@example.com', password: 'password123' }, // missing name
        {} // missing all fields
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/v1/auth/sign-up')
          .send(testCase)
          .expect(400);

        expect(response.body.message).toContain('required');
      }
    });

    it('should return 409 when user already exists', async () => {
      // Create user first
      await request(app)
        .post('/api/v1/auth/sign-up')
        .send(validUserData)
        .expect(201);

      // Try to create same user again
      const response = await request(app)
        .post('/api/v1/auth/sign-up')
        .send(validUserData)
        .expect(409);

      expect(response.body.message).toContain('already exists');
    });

    it('should hash the password before storing', async () => {
      await request(app)
        .post('/api/v1/auth/sign-up')
        .send(validUserData)
        .expect(201);

      const user = await User.findOne({ email: validUserData.email });
      expect(user.password).not.toBe(validUserData.password);
      expect(user.password.length).toBeGreaterThan(50); // bcrypt hash length
    });
  });

  describe('POST /api/v1/auth/sign-in', () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    };

    beforeEach(async () => {
      // Create a user for testing sign-in
      await request(app)
        .post('/api/v1/auth/sign-up')
        .send(userData);
    });

    it('should sign in user successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/sign-in')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      expect(response.body.status).toBe(true);
      expect(response.body.message).toContain('Logged in successfully');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.name).toBe(userData.name);
      expect(response.body.data.user.password).toBeUndefined();

      // Verify JWT token
      const decoded = jwt.verify(response.body.data.token, process.env.JWT_SECRET || 'test-secret');
      expect(decoded.userId).toBeDefined();
    });

    it('should return 400 when required fields are missing', async () => {
      const testCases = [
        { email: userData.email }, // missing password
        { password: userData.password }, // missing email
        {} // missing both fields
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/v1/auth/sign-in')
          .send(testCase)
          .expect(400);

        expect(response.body.message).toContain('required');
      }
    });

    it('should return 400 when user does not exist', async () => {
      const response = await request(app)
        .post('/api/v1/auth/sign-in')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid email or password');
    });

    it('should return 400 when password is incorrect', async () => {
      const response = await request(app)
        .post('/api/v1/auth/sign-in')
        .send({
          email: userData.email,
          password: 'wrongpassword'
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid email or password');
    });
  });

  describe('POST /api/v1/auth/sign-out', () => {
    it('should sign out user successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/sign-out')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Signed out successfully');
    });
  });
});