import express from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { getCachedRatings, getSlugToIdMap } from '../services/zerotrac.js';
import { fetchLeetcodeSolvedSlugs } from '../services/leetcode.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all rated problems with user's solved status (supports guest mode if no token provided)
router.get('/', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const ratings = getCachedRatings();

    let solvedSet = new Set();
    let userProfile = null;

    if (token) {
      const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';
      try {
        const decoded = jwt.verify(token, jwtSecret);
        const user = await User.findById(decoded.id).select('solvedProblems leetcodeUsername lastSynced');
        if (user) {
          solvedSet = new Set(user.solvedProblems);
          userProfile = {
            leetcodeUsername: user.leetcodeUsername,
            lastSynced: user.lastSynced,
            totalSolvedCount: solvedSet.size
          };
        }
      } catch (err) {
        // Token invalid or expired, continue as guest
      }
    }

    return res.json({
      problems: ratings,
      solvedIds: Array.from(solvedSet),
      user: userProfile
    });
  } catch (error) {
    console.error('[Problems Route] Error fetching problems:', error);
    return res.status(500).json({ error: 'Failed to fetch problems' });
  }
});

// Toggle solved status for a problem
router.post('/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const problemId = parseInt(req.params.id, 10);
    const { solved } = req.body;

    if (isNaN(problemId)) {
      return res.status(400).json({ error: 'Invalid problem ID' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let solvedSet = new Set(user.solvedProblems);

    if (solved === true || (solved === undefined && !solvedSet.has(problemId))) {
      solvedSet.add(problemId);
    } else {
      solvedSet.delete(problemId);
    }

    user.solvedProblems = Array.from(solvedSet);
    await user.save();

    return res.json({
      message: 'Status updated',
      problemId,
      isSolved: solvedSet.has(problemId),
      solvedIds: Array.from(solvedSet),
      totalSolvedCount: solvedSet.size
    });
  } catch (error) {
    console.error('[Problems Route] Toggle error:', error);
    return res.status(500).json({ error: 'Failed to update problem status' });
  }
});

// Sync solved problems from LeetCode account
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[Sync Route] Triggering sync for user ${user.username} (LeetCode: ${user.leetcodeUsername})`);

    const freshSlugs = await fetchLeetcodeSolvedSlugs(user.leetcodeUsername);
    const slugMap = getSlugToIdMap();

    const existingSolvedSet = new Set(user.solvedProblems);
    const initialSize = existingSolvedSet.size;

    // Add all fresh slugs
    freshSlugs.forEach(slug => {
      if (slugMap.has(slug)) {
        existingSolvedSet.add(slugMap.get(slug));
      }
    });

    const newSlugsSet = new Set([...user.solvedSlugs, ...freshSlugs]);

    user.solvedProblems = Array.from(existingSolvedSet);
    user.solvedSlugs = Array.from(newSlugsSet);
    user.lastSynced = new Date();

    await user.save();

    const newlyAdded = existingSolvedSet.size - initialSize;

    return res.json({
      message: `Synced successfully! Found ${newlyAdded} new solved problems.`,
      newlyAddedCount: newlyAdded,
      totalSolvedCount: existingSolvedSet.size,
      solvedIds: Array.from(existingSolvedSet),
      lastSynced: user.lastSynced
    });
  } catch (error) {
    console.error('[Sync Route] Error:', error);
    return res.status(500).json({ error: 'Failed to sync with LeetCode' });
  }
});

// Deep Sync using session cookie
router.post('/sync-full', authenticateToken, async (req, res) => {
  try {
    const { sessionCookie } = req.body;
    if (!sessionCookie) {
      return res.status(400).json({ error: 'Session cookie is required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[Sync Route] Triggering FULL deep sync for user ${user.username}`);

    const { fetchFullLeetcodeSolvedSlugs } = await import('../services/leetcode.js');
    const freshSlugs = await fetchFullLeetcodeSolvedSlugs(sessionCookie);
    
    const slugMap = getSlugToIdMap();
    const existingSolvedSet = new Set(user.solvedProblems);
    const initialSize = existingSolvedSet.size;

    // Add all fresh slugs
    freshSlugs.forEach(slug => {
      if (slugMap.has(slug)) {
        existingSolvedSet.add(slugMap.get(slug));
      }
    });

    const newSlugsSet = new Set([...user.solvedSlugs, ...freshSlugs]);

    user.solvedProblems = Array.from(existingSolvedSet);
    user.solvedSlugs = Array.from(newSlugsSet);
    user.lastSynced = new Date();

    await user.save();

    const newlyAdded = existingSolvedSet.size - initialSize;

    return res.json({
      message: `Deep Sync successful! Discovered ${freshSlugs.length} total solved problems on LeetCode. Added ${newlyAdded} new problems.`,
      newlyAddedCount: newlyAdded,
      totalSolvedCount: existingSolvedSet.size,
      solvedIds: Array.from(existingSolvedSet),
      lastSynced: user.lastSynced
    });
  } catch (error) {
    console.error('[Sync Route] Deep sync error:', error);
    return res.status(500).json({ error: error.message || 'Failed to deep sync with LeetCode' });
  }
});

export default router;
