process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/mern-starter-test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? '0123456789abcdef0123456789abcdef';
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? '0123456789abcdef0123456789abcdef';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'fatal';
