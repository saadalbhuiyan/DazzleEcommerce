// JWT sessions: issue, rotate, revoke

const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");
const { TokenSession } = require("../modules/auth/schema/token.model");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// create access/refresh and persist a refresh session (sid)
async function issueTokens(subjectId, type) {
  const sid = uuid();
  const days = Number(process.env.REFRESH_TTL_DAYS || 14);

  await TokenSession.create({
    userType: type,
    subjectId,
    refreshId: sid,
    expiresAt: new Date(Date.now() + days * MS_PER_DAY),
  });

  const access = jwt.sign(
    { sub: subjectId, type },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.ACCESS_TTL || "15m" }
  );

  const refresh = jwt.sign(
    { sid, type },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: `${days}d` }
  );

  return { access, refresh };
}

// invalidate old sid and issue a new pair
async function rotateRefresh(oldSid) {
  const sess = await TokenSession.findOne({ refreshId: oldSid, revokedAt: null });
  if (!sess) throw new Error("invalid session");

  sess.revokedAt = new Date();
  await sess.save();

  return issueTokens(sess.subjectId, sess.userType);
}

// revoke a single session by sid
async function revokeBySid(sid) {
  await TokenSession.updateOne(
    { refreshId: sid, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

// revoke all active sessions for a subject/type
async function revokeAll(subjectId, type) {
  await TokenSession.updateMany(
    { subjectId, userType: type, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

module.exports = { issueTokens, rotateRefresh, revokeBySid, revokeAll };
