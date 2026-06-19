const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const router   = express.Router();

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user   = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashed
    });

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, username: user.username });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { identifier, username, email, password } = req.body;
    const loginIdentifier = identifier || username || email;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: 'Email (or username) and password are required' });
    }

    const normalizedIdentifier = loginIdentifier.trim();
    const isEmail = normalizedIdentifier.includes('@');
    const user = isEmail
      ? await User.findOne({ email: normalizedIdentifier.toLowerCase() })
      : await User.findOne({ username: normalizedIdentifier });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return the user's previously joined rooms so the frontend can show them
    res.json({ token, username: user.username, rooms: user.rooms });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
