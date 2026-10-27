require('dotenv').config();

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const { connectToDatabase } = require('./config/db');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const mongoUrl = process.env.MONGO_URI;
const sessionSecret = process.env.SESSION_SECRET || 'fallback-session-secret-change-me-please-use-a-long-value';

const sessionStore = mongoUrl
  ? MongoStore.create({
      mongoUrl,
      collectionName: 'sessions',
      ttl: 60 * 60 * 24,
      touchAfter: 60 * 60,
      crypto: { secret: sessionSecret },
    })
  : null;

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24,
    },
    name: 'rarefinds.sid',
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);

app.use(express.static(path.join(__dirname)));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((error, req, res, next) => {
  if (error) {
    console.error('Unhandled error:', error.message);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }

  return next();
});

app.get('*', (req, res) => {
  if (req.path === '/' || /\.(html|css|js)$/.test(req.path) || req.path.startsWith('/css') || req.path.startsWith('/js')) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }

  return res.sendFile(path.join(__dirname, 'index.html'));
});

async function startServer() {
  try {
    await connectToDatabase();
    app.listen(PORT, () => {
      console.log(`Rarefinds server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Server could not start:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
