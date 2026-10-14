const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const env = require('./config/env');
const auth = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const studentsRoutes = require('./routes/students');
const categoriesRoutes = require('./routes/categories');
const productsRoutes = require('./routes/products');
const inventoryRoutes = require('./routes/inventory');
const kitRoutes = require('./routes/kit');
const ordersRoutes = require('./routes/orders');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const gstRoutes = require('./routes/gst');
const paymentsRoutes = require('./routes/payments');
const storefrontRoutes = require('./routes/storefront');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Admin and Student frontend URLs
const allowedOrigins = [
  process.env.ADMIN_CLIENT_ORIGIN,
  process.env.STUDENT_CLIENT_ORIGIN,
]
  .filter(Boolean)
  .map((origin) => origin.trim().replace(/\/$/, ""));

// Allow both frontend applications
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`CORS blocked origin: ${origin}`)
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-API-Key",
    ],
  })
);

app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
// app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// app.use(
//   cors({
//     origin: env.clientOrigin,
//     credentials: true,
//   })
// );
// app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(path.resolve(env.uploadDir)));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Scholar Store admin API is running',
    data: { env: env.nodeEnv },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/storefront', storefrontRoutes);

app.use('/api/admin', auth);
app.use('/api/admin/students', studentsRoutes);
app.use('/api/admin/categories', categoriesRoutes);
app.use('/api/admin/products', productsRoutes);
app.use('/api/admin/inventory', inventoryRoutes);
app.use('/api/admin/kit', kitRoutes);
app.use('/api/admin/orders', ordersRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/admin/settings', settingsRoutes);
app.use('/api/admin/gst', gstRoutes);
app.use('/api/admin/payments', paymentsRoutes);

app.use('/api/admin', (req, res) => {
  res.status(404).json({ success: false, message: 'Admin route not found' });
});

app.use(errorHandler);

module.exports = app;
