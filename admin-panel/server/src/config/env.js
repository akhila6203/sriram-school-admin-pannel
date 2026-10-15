require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER ?? 'scholar',
    password: process.env.DB_PASSWORD ?? 'scholar',
    database: process.env.DB_NAME || 'scholar_store',
  },
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',

  // clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  adminClientOrigin:
    process.env.ADMIN_CLIENT_ORIGIN || 'http://localhost:5173',
  studentClientOrigin:
    process.env.STUDENT_CLIENT_ORIGIN || 'http://localhost:5174',

  cookieSecure: process.env.COOKIE_SECURE === 'true',
  adminSeedEmail: process.env.ADMIN_SEED_EMAIL || 'admin@scholarstore.local',
  adminSeedPassword: process.env.ADMIN_SEED_PASSWORD || 'Admin@12345',
  adminSeedName: process.env.ADMIN_SEED_NAME || 'Super Admin',
  storefrontApiKey: process.env.STOREFRONT_API_KEY || 'dev-storefront-api-key',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  settingsEncryptionKey:
    process.env.SETTINGS_ENCRYPTION_KEY ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`,
};

module.exports = env;
