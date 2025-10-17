// middleware/userAuth.js

'use strict';

const jwt = require('jsonwebtoken');

// Middleware: verify user access token
module.exports = (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').split(' ')[1];
    if (!token) {
      return res.status(401).json({ ok: false, message: 'Missing user token' });
    }

    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    if (payload.type !== 'user') {
      return res.status(403).json({ ok: false, message: 'Forbidden: user only' });
    }

    req.user = { id: payload.sub };
    next();
  } catch {
    res.status(401).json({ ok: false, message: 'Invalid or expired user token' });
  }
};
