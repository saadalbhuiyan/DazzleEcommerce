const jwt = require("jsonwebtoken");
const { User } = require("../schema/user.model");
const { OtpCode } = require("../schema/otp.model");
const { issueTokens, rotateRefresh, revokeBySid, revokeAll } = require("../../../utils/jwt");
const { hash, verify } = require("../../../utils/crypto");
const { getTransportFromDb } = require("../../../config/smtp");
const { ok, err } = require("../../../utils/response");
const { saveWebp, deleteLocal } = require("../../../utils/image");

const setRefreshCookie = (res, token) =>
  res.cookie("rt", token, {
    httpOnly: true, secure: true, sameSite: "strict", path: "/",
    maxAge: 1000 * 60 * 60 * 24 * Number(process.env.REFRESH_TTL_DAYS || 14)
  });

// ---- AUTH — OTP ----
exports.requestOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return err(res, 400, "email required");
    const code = String(Math.floor(Math.random()*1e6)).padStart(6,"0");
    await OtpCode.deleteMany({ email });
    await OtpCode.create({ email, codeHash: await hash(code), expiresAt: new Date(Date.now() + 3*60*1000) });
    const t = await getTransportFromDb();
    await t.sendMail({ to: email, subject: "Your Login Code", html: `<p>Your OTP is <b>${code}</b> (valid 3 minutes).</p>` });
    ok(res, { sent: true });
  } catch (e) { next(e); }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const { email, code } = req.body;
    const entry = await OtpCode.findOne({ email });
    if (!entry || entry.expiresAt < new Date()) return err(res, 400, "OTP expired");
    if (!await verify(code, entry.codeHash)) return err(res, 400, "Invalid OTP");

    let user = await User.findOne({ email });
    if (!user) user = await User.create({ email });
    const { access, refresh } = await issueTokens(user.id, "user");
    setRefreshCookie(res, refresh);
    await OtpCode.deleteMany({ email });
    ok(res, { access });
  } catch (e) { next(e); }
};

exports.refresh = async (req, res, next) => {
  try {
    const token = req.cookies.rt;
    if (!token) return err(res, 401, "missing refresh");
    const p = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const { access, refresh } = await rotateRefresh(p.sid);
    setRefreshCookie(res, refresh);
    ok(res, { access });
  } catch (e) { next(e); }
};

exports.logout = async (req, res, next) => {
  try {
    const token = req.cookies.rt;
    if (token) {
      const p = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      await revokeBySid(p.sid);
    }
    res.clearCookie("rt", { path: "/" });
    ok(res, { loggedOut: true });
  } catch (e) { next(e); }
};

exports.deleteAccount = async (req, res, next) => {
  try {
    const token = (req.headers.authorization || "").split(" ")[1];
    if (!token) return err(res, 401, "missing token");
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    await User.findByIdAndUpdate(payload.sub, { isDeleted: true });
    await revokeAll(payload.sub, "user");
    res.clearCookie("rt", { path: "/" });
    ok(res, { deleted: true });
  } catch (e) { next(e); }
};

// ---- PROFILE CRUD ----
// NAME
exports.nameCreate = async (req, res, next) => {
  try { 
    const u = await User.findById(req.user.id).select("name");
    if (u?.name) return err(res, 409, "Name exists. Use PUT.");
    const x = await User.findByIdAndUpdate(req.user.id, { name: req.body.name || "" }, { new: true }).select("name");
    ok(res, { name: x.name });
  } catch (e) { next(e); }
};
exports.nameRead = async (req, res, next) => {
  try { const u = await User.findById(req.user.id).select("name"); ok(res, { name: u?.name ?? null }); }
  catch (e) { next(e); }
};
exports.nameUpdate = async (req, res, next) => {
  try { const u = await User.findByIdAndUpdate(req.user.id, { name: req.body.name }, { new: true }).select("name"); ok(res, { name: u.name }); }
  catch (e) { next(e); }
};
exports.nameDelete = async (req, res, next) => {
  try { const u = await User.findByIdAndUpdate(req.user.id, { $set: { name: null } }, { new: true }).select("name"); ok(res, { name: u.name }); }
  catch (e) { next(e); }
};

// MOBILE
exports.mobileCreate = async (req, res, next) => {
  try { 
    const u = await User.findById(req.user.id).select("mobile");
    if (u?.mobile) return err(res, 409, "Mobile exists. Use PUT.");
    const x = await User.findByIdAndUpdate(req.user.id, { mobile: req.body.mobile || "" }, { new: true }).select("mobile");
    ok(res, { mobile: x.mobile });
  } catch (e) { next(e); }
};
exports.mobileRead = async (req, res, next) => {
  try { const u = await User.findById(req.user.id).select("mobile"); ok(res, { mobile: u?.mobile ?? null }); }
  catch (e) { next(e); }
};
exports.mobileUpdate = async (req, res, next) => {
  try { const u = await User.findByIdAndUpdate(req.user.id, { mobile: req.body.mobile }, { new: true }).select("mobile"); ok(res, { mobile: u.mobile }); }
  catch (e) { next(e); }
};
exports.mobileDelete = async (req, res, next) => {
  try { const u = await User.findByIdAndUpdate(req.user.id, { $set: { mobile: null } }, { new: true }).select("mobile"); ok(res, { mobile: u.mobile }); }
  catch (e) { next(e); }
};

// ADDRESS
exports.addressCreate = async (req, res, next) => {
  try {
    const u = await User.findById(req.user.id).select("address");
    if (u?.address) return err(res, 409, "Address exists. Use PUT.");
    const x = await User.findByIdAndUpdate(req.user.id, { address: req.body.address || "" }, { new: true }).select("address");
    ok(res, { address: x.address });
  } catch (e) { next(e); }
};
exports.addressRead = async (req, res, next) => {
  try { const u = await User.findById(req.user.id).select("address"); ok(res, { address: u?.address ?? null }); }
  catch (e) { next(e); }
};
exports.addressUpdate = async (req, res, next) => {
  try { const u = await User.findByIdAndUpdate(req.user.id, { address: req.body.address }, { new: true }).select("address"); ok(res, { address: u.address }); }
  catch (e) { next(e); }
};
exports.addressDelete = async (req, res, next) => {
  try { const u = await User.findByIdAndUpdate(req.user.id, { $set: { address: null } }, { new: true }).select("address"); ok(res, { address: u.address }); }
  catch (e) { next(e); }
};

// PICTURE
exports.picCreate = async (req, res, next) => {
  try {
    if (!req.file) return err(res, 400, "file required");
    const u = await User.findById(req.user.id).select("pictureUrl");
    if (u?.pictureUrl) return err(res, 409, "Picture exists. Use PUT.");
    const out = await saveWebp(req.file.buffer, { area: "users", entityId: req.user.id });
    const x = await User.findByIdAndUpdate(req.user.id, { pictureUrl: out.path }, { new: true }).select("pictureUrl");
    ok(res, { pictureUrl: x.pictureUrl });
  } catch (e) { next(e); }
};
exports.picRead = async (req, res, next) => {
  try { const u = await User.findById(req.user.id).select("pictureUrl"); ok(res, { pictureUrl: u?.pictureUrl ?? null }); }
  catch (e) { next(e); }
};
exports.picUpdate = async (req, res, next) => {
  try {
    if (!req.file) return err(res, 400, "file required");
    const u = await User.findById(req.user.id).select("pictureUrl");
    if (u?.pictureUrl) deleteLocal(u.pictureUrl);
    const out = await saveWebp(req.file.buffer, { area: "users", entityId: req.user.id });
    const x = await User.findByIdAndUpdate(req.user.id, { pictureUrl: out.path }, { new: true }).select("pictureUrl");
    ok(res, { pictureUrl: x.pictureUrl });
  } catch (e) { next(e); }
};
exports.picDelete = async (req, res, next) => {
  try {
    const u = await User.findById(req.user.id).select("pictureUrl");
    if (u?.pictureUrl) deleteLocal(u.pictureUrl);
    const x = await User.findByIdAndUpdate(req.user.id, { $set: { pictureUrl: null } }, { new: true }).select("pictureUrl");
    ok(res, { pictureUrl: x.pictureUrl });
  } catch (e) { next(e); }
};
