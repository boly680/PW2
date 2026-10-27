const express = require('express');
const bcrypt = require('bcrypt');
const csrf = require('csurf');
const User = require('../models/User');
const { requireAuth, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const csrfProtection = csrf({ cookie: false });

function sanitizeName(name) {
  return String(name || '').trim();
}

function sanitizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

router.get('/csrf-token', csrfProtection, (req, res) => {
  return res.json({ csrfToken: req.csrfToken() });
});

router.get('/session', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-password');

    if (!user) {
      req.session.destroy((error) => {
        if (error) {
          console.error('Session destroy failed:', error.message);
        }
      });
      return res.status(401).json({ message: 'Session invalid.' });
    }

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Session fetch failed:', error.message);
    return res.status(500).json({ message: 'Unable to load your session right now.' });
  }
});

router.post('/register', csrfProtection, async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    const email = sanitizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ message: 'Name must be between 2 and 100 characters.' });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }

    if (req.body.role && req.body.role !== 'user') {
      return res.status(400).json({ message: 'Only a standard user role can be assigned during registration.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'user',
    });

    return res.status(201).json({
      message: 'Account created successfully. You can now log in.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Registration failed:', error.message);
    return res.status(500).json({ message: 'Unable to create your account right now.' });
  }
});

router.post('/login', csrfProtection, async (req, res) => {
  try {
    const email = sanitizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    req.session.regenerate((error) => {
      if (error) {
        console.error('Session regeneration failed:', error.message);
        return res.status(500).json({ message: 'Unable to start a secure session.' });
      }

      req.session.userId = user._id.toString();
      req.session.userRole = user.role;
      req.session.save((saveError) => {
        if (saveError) {
          console.error('Session save failed:', saveError.message);
          return res.status(500).json({ message: 'Unable to save your session.' });
        }

        return res.json({
          message: 'Login successful.',
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        });
      });
    });
  } catch (error) {
    console.error('Login failed:', error.message);
    return res.status(500).json({ message: 'Unable to log in right now.' });
  }
});

router.post('/logout', csrfProtection, requireAuth, (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error('Logout failed:', error.message);
      return res.status(500).json({ message: 'Unable to log out right now.' });
    }

    res.clearCookie('connect.sid');
    return res.json({ message: 'Logged out successfully.' });
  });
});

router.get('/admin-only', requireAuth, authorizeRoles('admin'), (req, res) => {
  return res.json({ message: 'Admin area access granted.' });
});

module.exports = router;
