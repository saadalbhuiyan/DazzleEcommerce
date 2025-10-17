// middleware/adminAuth.js

'use strict';

const jwt = require('jsonwebtoken');

// Middleware: verify admin access token
module.exports = (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').split(' ')[1];
    if (!token) {
      return res.status(401).json({ ok: false, message: 'Missing admin token' });
    }

    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    if (payload.type !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden: admin only' });
    }

    req.admin = { id: payload.sub };
    next();
  } catch {
    res.status(401).json({ ok: false, message: 'Invalid or expired admin token' });
  }
};
