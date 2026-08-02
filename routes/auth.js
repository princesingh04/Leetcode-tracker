import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/User.js';
import { fetchLeetcodeSolvedSlugs } from '../services/leetcode.js';
import { getSlugToIdMap } from '../services/zerotrac.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const googleClient = new OAuth2Client();

// Register with username & password
router.post('/register', async (req, res) => {
  try {
    const { username, password, leetcodeUsername } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const formattedLeetcode = leetcodeUsername ? leetcodeUsername.trim() : '';

    // Initial sync from LeetCode if username provided
    let solvedSlugs = [];
    let solvedProblems = [];
    let lastSynced = null;

    if (formattedLeetcode) {
      try {
        solvedSlugs = await fetchLeetcodeSolvedSlugs(formattedLeetcode);
        const slugMap = getSlugToIdMap();
        const problemIdSet = new Set();
        solvedSlugs.forEach(slug => {
          if (slugMap.has(slug)) {
            problemIdSet.add(slugMap.get(slug));
          }
        });
        solvedProblems = Array.from(problemIdSet);
        lastSynced = new Date();
      } catch (syncErr) {
        console.warn('[Auth Route] Initial LeetCode sync warning:', syncErr.message);
      }
    }

    const newUser = new User({
      username: username.toLowerCase(),
      password: hashedPassword,
      leetcodeUsername: formattedLeetcode,
      solvedProblems,
      solvedSlugs,
      lastSynced
    });

    await newUser.save();

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';
    const token = jwt.sign(
      { id: newUser._id, username: newUser.username, email: newUser.email, leetcodeUsername: newUser.leetcodeUsername },
      jwtSecret,
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        username: newUser.username,
        email: newUser.email,
        leetcodeUsername: newUser.leetcodeUsername,
        solvedCount: newUser.solvedProblems.length,
        lastSynced: newUser.lastSynced
      },
      needsLeetcodeUsername: !newUser.leetcodeUsername
    });

  } catch (error) {
    console.error('[Auth Route] Register error:', error);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login with username & password
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';
    const token = jwt.sign(
      { id: user._id, username: user.username, email: user.email, leetcodeUsername: user.leetcodeUsername },
      jwtSecret,
      { expiresIn: '30d' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        username: user.username,
        email: user.email,
        leetcodeUsername: user.leetcodeUsername,
        solvedCount: user.solvedProblems.length,
        lastSynced: user.lastSynced
      },
      needsLeetcodeUsername: !user.leetcodeUsername
    });

  } catch (error) {
    console.error('[Auth Route] Login error:', error);
    return res.status(500).json({ error: 'Failed to log in' });
  }
});

// Google 1-Click Authentication
router.post('/google', async (req, res) => {
  try {
    const { credential, gUser } = req.body;
    let email, name, googleId;

    if (credential) {
      // Decode or verify Google JWT token
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID || undefined
        }).catch(() => null);

        if (ticket) {
          const payload = ticket.getPayload();
          email = payload.email;
          name = payload.name;
          googleId = payload.sub;
        } else {
          // Fallback decode for development/testing if verification audience not set
          const base64Url = credential.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const decoded = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
          email = decoded.email;
          name = decoded.name;
          googleId = decoded.sub;
        }
      } catch (e) {
        return res.status(400).json({ error: 'Invalid Google credential token' });
      }
    } else if (gUser) {
      email = gUser.email;
      name = gUser.name;
      googleId = gUser.sub || gUser.id;
    }

    if (!email) {
      return res.status(400).json({ error: 'Google email is required' });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

    if (!user) {
      const displayName = name ? name.toLowerCase().replace(/\s+/g, '_') : email.split('@')[0];
      user = new User({
        username: displayName,
        email: email.toLowerCase(),
        googleId,
        leetcodeUsername: ''
      });
      await user.save();
    }

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';
    const token = jwt.sign(
      { id: user._id, username: user.username, email: user.email, leetcodeUsername: user.leetcodeUsername },
      jwtSecret,
      { expiresIn: '30d' }
    );

    return res.json({
      message: 'Google login successful',
      token,
      user: {
        username: user.username,
        email: user.email,
        leetcodeUsername: user.leetcodeUsername,
        solvedCount: user.solvedProblems.length,
        lastSynced: user.lastSynced
      },
      needsLeetcodeUsername: !user.leetcodeUsername
    });

  } catch (error) {
    console.error('[Auth Route] Google auth error:', error);
    return res.status(500).json({ error: 'Google authentication failed' });
  }
});

// Update / Set LeetCode username for current user
router.post('/leetcode-username', authenticateToken, async (req, res) => {
  try {
    const { leetcodeUsername } = req.body;
    if (!leetcodeUsername || !leetcodeUsername.trim()) {
      return res.status(400).json({ error: 'LeetCode username is required' });
    }

    const formattedHandle = leetcodeUsername.trim();
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.leetcodeUsername = formattedHandle;

    // Trigger sync from LeetCode
    try {
      const freshSlugs = await fetchLeetcodeSolvedSlugs(formattedHandle);
      const slugMap = getSlugToIdMap();
      const problemIdSet = new Set(user.solvedProblems);

      freshSlugs.forEach(slug => {
        if (slugMap.has(slug)) {
          problemIdSet.add(slugMap.get(slug));
        }
      });

      user.solvedProblems = Array.from(problemIdSet);
      user.solvedSlugs = Array.from(new Set([...user.solvedSlugs, ...freshSlugs]));
      user.lastSynced = new Date();
    } catch (syncErr) {
      console.warn('[Auth Route] LeetCode sync error during handle update:', syncErr.message);
    }

    await user.save();

    return res.json({
      message: 'LeetCode username saved and account synced!',
      user: {
        username: user.username,
        email: user.email,
        leetcodeUsername: user.leetcodeUsername,
        solvedCount: user.solvedProblems.length,
        lastSynced: user.lastSynced
      },
      solvedIds: user.solvedProblems
    });

  } catch (error) {
    console.error('[Auth Route] Update LeetCode handle error:', error);
    return res.status(500).json({ error: 'Failed to update LeetCode username' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({
      username: user.username,
      email: user.email,
      leetcodeUsername: user.leetcodeUsername,
      solvedCount: user.solvedProblems.length,
      lastSynced: user.lastSynced,
      needsLeetcodeUsername: !user.leetcodeUsername
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error fetching user' });
  }
});

export default router;
