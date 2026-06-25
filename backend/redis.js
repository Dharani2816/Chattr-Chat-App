const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    console.log(`Redis reconnecting in ${delay}ms (attempt ${times})...`);
    return delay;
  }
});

redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err.message));

/**
 * Returns a promise that resolves once the Redis client is ready.
 * Rejects after 10 seconds if the connection cannot be established.
 */
function connectRedis() {
  return new Promise((resolve, reject) => {
    if (redis.status === 'ready') return resolve();

    const timeout = setTimeout(() => {
      reject(new Error('Redis connection timed out after 10s'));
    }, 10000);

    redis.once('ready', () => {
      clearTimeout(timeout);
      resolve();
    });

    redis.once('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

module.exports = { redis, connectRedis };
