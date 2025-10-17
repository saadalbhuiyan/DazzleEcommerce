const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");
const { TokenSession } = require("../modules/auth/schema/token.model");

async function issueTokens(subjectId, type) {
  const sid = uuid();
  const days = Number(process.env.REFRESH_TTL_DAYS || 14);
  await TokenSession.create({
    userType: type, subjectId, refreshId: sid,
    expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  });
  const access = jwt.sign({ sub: subjectId, type }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.ACCESS_TTL || "15m"
  });
  const refresh = jwt.sign({ sid, type }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: `${days}d`
  });
  return { access, refresh };
}

async function rotateRefresh(oldSid) {
  const s = await TokenSession.findOne({ refreshId: oldSid, revokedAt: null });
  if (!s) throw new Error("invalid session");
  s.revokedAt = new Date();
  await s.save();
  return issueTokens(s.subjectId, s.userType);
}

async function revokeBySid(sid) {
  await TokenSession.updateOne({ refreshId: sid, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

async function revokeAll(subjectId, type) {
  await TokenSession.updateMany({ subjectId, userType: type, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

module.exports = { issueTokens, rotateRefresh, revokeBySid, revokeAll };
