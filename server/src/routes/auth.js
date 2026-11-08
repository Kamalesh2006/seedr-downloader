const express = require('express');
const router = express.Router();
const defaultSeedrService = require('../services/seedrService');
const { SeedrService, createUserSeedrService } = defaultSeedrService;
const { extractAuth, generateToken } = require('../middleware/auth');
const { sanitizeErrorMessage } = require('../middleware/errorHandler');

/**
 * 1. Login with Seedr email & password
 * Credentials are used in-memory ONLY to obtain an access_token, then immediately discarded.
 * No password or login details are stored in any database or file.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide both email and password.' });
    }

    let tokenData;
    try {
      tokenData = await SeedrService.loginWithCredentials(email.trim(), password);
    } catch (authErr) {
      const errMsg = authErr.error_description || authErr.error || authErr.message || 'Invalid Seedr login credentials';
      return res.status(401).json({ error: errMsg });
    }

    if (!tokenData || !tokenData.access_token) {
      return res.status(401).json({ error: 'Failed to authenticate with Seedr.' });
    }

    // Fetch user account settings from Seedr to get profile & live storage capacity
    const userSeedr = createUserSeedrService({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token
    });

    let account = {};
    try {
      const settingsData = await userSeedr.getSettings();
      account = settingsData?.account || {};
    } catch (e) {
      console.warn('Could not fetch user settings immediately after login:', e.message);
    }

    const userId = account.user_id || `user_${Date.now()}`;
    const userEmail = account.email || email.trim();
    const username = account.username || userEmail.split('@')[0];
    const premium = !!account.premium;

    // Generate signed stateless session token (JWT)
    const token = generateToken({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      userId,
      email: userEmail,
      username,
      premium
    });

    res.json({
      success: true,
      token,
      user: {
        userId,
        email: userEmail,
        username,
        premium,
        spaceUsed: account.space_used || 0,
        spaceMax: account.space_max || (premium ? 32212254720 : 2147483648),
        packageName: account.package_name || (premium ? 'Premium' : 'Free')
      }
    });
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error, 'Login failed. Please try again.') });
  }
});

/**
 * 2. Get current profile details & storage quota
 */
router.get('/me', extractAuth, async (req, res) => {
  try {
    if (req.user.isGuest) {
      // In Guest Mode, return guest status and shared storage info
      let guestSpace = { spaceUsed: 0, spaceMax: 4831838208 };
      try {
        const root = await defaultSeedrService.listFolder();
        guestSpace.spaceUsed = root.space_used || 0;
        guestSpace.spaceMax = root.space_max || 4831838208;
      } catch (e) {}

      return res.json({
        isGuest: true,
        user: {
          userId: 'guest',
          email: 'Guest Mode',
          username: 'Guest',
          premium: false,
          spaceUsed: guestSpace.spaceUsed,
          spaceMax: guestSpace.spaceMax,
          packageName: 'Shared Guest Pool'
        }
      });
    }

    // Authenticated User: fetch live quota from Seedr
    let account = {};
    try {
      const settingsData = await req.seedr.getSettings();
      account = settingsData?.account || {};
    } catch (err) {
      console.warn('Failed to fetch settings for /auth/me:', err.message);
    }

    res.json({
      isGuest: false,
      user: {
        userId: req.user.userId,
        email: req.user.email || account.email,
        username: req.user.username || account.username,
        premium: account.premium !== undefined ? !!account.premium : req.user.premium,
        spaceUsed: account.space_used !== undefined ? account.space_used : 0,
        spaceMax: account.space_max !== undefined ? account.space_max : 2147483648,
        packageName: account.package_name || (req.user.premium ? 'Premium' : 'Free')
      }
    });
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error, 'Failed to fetch user profile.') });
  }
});

/**
 * 3. Request a Device Code for passwordless linking via seedr.cc/devices
 */
router.post('/device-code', async (req, res) => {
  try {
    const data = await SeedrService.getDeviceCode();
    if (!data || !data.device_code) {
      return res.status(500).json({ error: 'Failed to initiate device authentication with Seedr.' });
    }

    res.json({
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUrl: data.verification_url || 'https://www.seedr.cc/devices',
      expiresIn: data.expires_in || 1800,
      interval: data.interval || 5
    });
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error, 'Failed to request device authorization code.') });
  }
});

/**
 * 4. Poll / Exchange Device Code for Access Token once authorized
 */
router.post('/device-token', async (req, res) => {
  try {
    const { deviceCode } = req.body;
    if (!deviceCode) {
      return res.status(400).json({ error: 'deviceCode is required' });
    }

    const data = await SeedrService.pollDeviceCode(deviceCode);

    if (data && data.error === 'authorization_pending') {
      return res.json({ status: 'pending', message: 'Waiting for authorization...' });
    }

    if (data && data.access_token) {
      // User authorized the device code!
      const userSeedr = createUserSeedrService({
        accessToken: data.access_token,
        refreshToken: data.refresh_token
      });

      let account = {};
      try {
        const settingsData = await userSeedr.getSettings();
        account = settingsData?.account || {};
      } catch (e) {}

      const userId = account.user_id || `user_${Date.now()}`;
      const userEmail = account.email || 'Seedr User';
      const username = account.username || userEmail.split('@')[0];
      const premium = !!account.premium;

      const token = generateToken({
        accessToken: data.access_token,
        refreshToken: data.refresh_token || null,
        userId,
        email: userEmail,
        username,
        premium
      });

      return res.json({
        status: 'success',
        token,
        user: {
          userId,
          email: userEmail,
          username,
          premium,
          spaceUsed: account.space_used || 0,
          spaceMax: account.space_max || (premium ? 32212254720 : 2147483648),
          packageName: account.package_name || (premium ? 'Premium' : 'Free')
        }
      });
    }

    if (data && data.error) {
      return res.status(400).json({ error: data.error });
    }

    return res.status(500).json({ error: 'Unexpected response from Seedr device authorization' });
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error, 'Failed to verify device code.') });
  }
});

module.exports = router;

