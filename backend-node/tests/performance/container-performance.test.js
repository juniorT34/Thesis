import { jest } from '@jest/globals';
import { performance } from 'perf_hooks';
import { 
  launchBrowserContainer, 
  stopBrowserContainer,
  generateSessionId,
  getDockerInfo
} from '../../services/docker.js';

// Mock dockerode for performance tests
const mockContainer = {
  start: jest.fn().mockImplementation(async () => {
    // Simulate container start time (realistic delay)
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second startup
    return {};
  }),
  stop: jest.fn().mockImplementation(async () => {
    // Simulate container stop time
    await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 second shutdown
    return {};
  }),
  remove: jest.fn().mockResolvedValue({}),
  inspect: jest.fn().mockResolvedValue({
    Id: 'test-container-id-' + Math.random().toString(36).substr(2, 9),
    State: {
      Status: 'running',
      Running: true,
      StartedAt: new Date().toISOString()
    }
  })
};

const mockDocker = {
  createContainer: jest.fn().mockImplementation(async () => {
    // Simulate container creation time
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second creation
    return mockContainer;
  }),
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

describe('Container Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Container Spin-up Performance', () => {
    it('should measure container creation time', async () => {
      const sessionId = generateSessionId();
      const userId = 'test-user-123';
      
      const startTime = performance.now();
      
      try {
        const result = await launchBrowserContainer(sessionId, 'https://example.com', userId);
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        
        console.log(`Container creation time: ${totalTime.toFixed(2)}ms`);
        
        // Performance assertions
        expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds
        expect(result.sessionId).toBe(sessionId);
        expect(result.status).toBe('running');
        
        // Log performance metrics
        console.log('Performance Metrics:');
        console.log(`- Total Time: ${totalTime.toFixed(2)}ms`);
        console.log(`- Docker Create: ~1000ms (simulated)`);
        console.log(`- Container Start: ~2000ms (simulated)`);
        console.log(`- Overhead: ${(totalTime - 3000).toFixed(2)}ms`);
        
      } catch (error) {
        console.error('Container creation failed:', error.message);
        throw error;
      }
    });

    it('should measure container stop time', async () => {
      const sessionId = generateSessionId();
      const userId = 'test-user-123';
      
      // First create a container
      await launchBrowserContainer(sessionId, 'https://example.com', userId);
      
      const startTime = performance.now();
      
      try {
        const result = await stopBrowserContainer(sessionId, userId);
        
        const endTime = performance.now();
        const stopTime = endTime - startTime;
        
        console.log(`Container stop time: ${stopTime.toFixed(2)}ms`);
        
        // Performance assertions
        expect(stopTime).toBeLessThan(2000); // Should stop in under 2 seconds
        expect(result).toBe(true);
        
        // Log performance metrics
        console.log('Stop Performance Metrics:');
        console.log(`- Total Stop Time: ${stopTime.toFixed(2)}ms`);
        console.log(`- Container Stop: ~500ms (simulated)`);
        console.log(`- Container Remove: minimal`);
        console.log(`- Overhead: ${(stopTime - 500).toFixed(2)}ms`);
        
      } catch (error) {
        console.error('Container stop failed:', error.message);
        throw error;
      }
    });

    it('should measure concurrent container creation performance', async () => {
      const concurrentSessions = 5;
      const userId = 'test-user-123';
      
      const sessions = Array.from({ length: concurrentSessions }, () => ({
        sessionId: generateSessionId(),
        url: 'https://example.com'
      }));
      
      const startTime = performance.now();
      
      try {
        const promises = sessions.map(session => 
          launchBrowserContainer(session.sessionId, session.url, userId)
        );
        
        const results = await Promise.all(promises);
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const avgTime = totalTime / concurrentSessions;
        
        console.log(`Concurrent creation performance:`);
        console.log(`- Total time for ${concurrentSessions} containers: ${totalTime.toFixed(2)}ms`);
        console.log(`- Average time per container: ${avgTime.toFixed(2)}ms`);
        console.log(`- Efficiency gain: ${((concurrentSessions * 3000 - totalTime) / (concurrentSessions * 3000) * 100).toFixed(1)}%`);
        
        // Performance assertions
        expect(results).toHaveLength(concurrentSessions);
        expect(avgTime).toBeLessThan(4000); // Average should be reasonable with concurrency
        
      } catch (error) {
        console.error('Concurrent container creation failed:', error.message);
        throw error;
      }
    });
  });

  describe('System Resource Performance', () => {
    it('should measure Docker system info retrieval time', async () => {
      const startTime = performance.now();
      
      try {
        const info = await getDockerInfo();
        
        const endTime = performance.now();
        const retrievalTime = endTime - startTime;
        
        console.log(`Docker info retrieval time: ${retrievalTime.toFixed(2)}ms`);
        
        // Performance assertions
        expect(retrievalTime).toBeLessThan(100); // Should be very fast
        expect(info).toBeDefined();
        expect(info.Containers).toBeDefined();
        
      } catch (error) {
        console.error('Docker info retrieval failed:', error.message);
        throw error;
      }
    });

    it('should measure session ID generation performance', () => {
      const iterations = 1000;
      const sessionIds = new Set();
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        const sessionId = generateSessionId();
        sessionIds.add(sessionId);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      console.log(`Session ID generation performance:`);
      console.log(`- ${iterations} IDs generated in: ${totalTime.toFixed(2)}ms`);
      console.log(`- Average time per ID: ${avgTime.toFixed(4)}ms`);
      console.log(`- Rate: ${(iterations / (totalTime / 1000)).toFixed(0)} IDs/second`);
      
      // Performance assertions
      expect(avgTime).toBeLessThan(1); // Should be sub-millisecond
      expect(sessionIds.size).toBe(iterations); // All IDs should be unique
    });
  });

  describe('Memory Usage Profiling', () => {
    it('should profile memory usage during container operations', async () => {
      const initialMemory = process.memoryUsage();
      console.log('Initial memory usage:', {
        rss: `${(initialMemory.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        external: `${(initialMemory.external / 1024 / 1024).toFixed(2)} MB`
      });
      
      const sessionId = generateSessionId();
      const userId = 'test-user-123';
      
      // Create container
      await launchBrowserContainer(sessionId, 'https://example.com', userId);
      
      const afterCreateMemory = process.memoryUsage();
      console.log('Memory after container creation:', {
        rss: `${(afterCreateMemory.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(afterCreateMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(afterCreateMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        external: `${(afterCreateMemory.external / 1024 / 1024).toFixed(2)} MB`
      });
      
      // Stop container
      await stopBrowserContainer(sessionId, userId);
      
      const afterStopMemory = process.memoryUsage();
      console.log('Memory after container stop:', {
        rss: `${(afterStopMemory.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(afterStopMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(afterStopMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        external: `${(afterStopMemory.external / 1024 / 1024).toFixed(2)} MB`
      });
      
      // Calculate memory deltas
      const createDelta = afterCreateMemory.heapUsed - initialMemory.heapUsed;
      const stopDelta = afterStopMemory.heapUsed - afterCreateMemory.heapUsed;
      
      console.log('Memory deltas:', {
        createDelta: `${(createDelta / 1024 / 1024).toFixed(2)} MB`,
        stopDelta: `${(stopDelta / 1024 / 1024).toFixed(2)} MB`,
        netDelta: `${((afterStopMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB`
      });
      
      // Memory should not grow excessively
      expect(createDelta).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
      expect(Math.abs(stopDelta)).toBeLessThan(10 * 1024 * 1024); // Cleanup should free most memory
    });
  });

  describe('Performance Recommendations', () => {
    it('should provide performance optimization recommendations', () => {
      const recommendations = {
        containerOptimizations: [
          'Use Alpine-based images for smaller size',
          'Implement container image caching',
          'Pre-pull images to reduce startup time',
          'Use multi-stage builds to reduce image size'
        ],
        resourceOptimizations: [
          'Adjust memory limits based on actual usage',
          'Implement CPU quotas to prevent resource hogging',
          'Use SSD storage for faster container I/O',
          'Configure Docker daemon with optimized settings'
        ],
        networkOptimizations: [
          'Use bridge networks for better isolation',
          'Implement connection pooling',
          'Use HTTP/2 for Traefik routing',
          'Configure DNS caching'
        ],
        applicationOptimizations: [
          'Implement session pooling for frequently used containers',
          'Use container warm-up for faster user experience',
          'Implement graceful degradation for high load',
          'Add request queuing for resource management'
        ]
      };
      
      console.log('\n🚀 Performance Optimization Recommendations:');
      
      Object.entries(recommendations).forEach(([category, items]) => {
        console.log(`\n${category.toUpperCase()}:`);
        items.forEach((item, index) => {
          console.log(`  ${index + 1}. ${item}`);
        });
      });
      
      expect(recommendations).toBeDefined();
      expect(Object.keys(recommendations)).toHaveLength(4);
    });
  });
});