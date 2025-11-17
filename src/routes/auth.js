const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { findUserByEmail } = require('../services/userService');
const { generateOtp, storeOtp, verifyOtp, purgeExpiredOtps } = require('../services/otpService');
const { sendOtpEmail } = require('../services/emailService');

const router = express.Router();

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

router.get(
  '/login',
  asyncHandler(async (req, res) => {
    if (req.session.userId) {
      return res.redirect('/dashboard');
    }
    return res.render('login', { title: 'Entrar', email: req.query.email || '' });
  }),
);

router.post(
  '/login/send-otp',
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) {
      setFlash(req, 'error', 'Indique o email.');
      return res.redirect('/login');
    }

    const user = await findUserByEmail(email);
    if (!user) {
      setFlash(req, 'error', 'Email não encontrado.');
      return res.redirect('/login');
    }

    const otp = generateOtp();
    await purgeExpiredOtps();
    await storeOtp(email, otp);
    await sendOtpEmail(email, otp);

    setFlash(req, 'success', 'Código enviado por email.');
    return res.redirect(`/login/verify?email=${encodeURIComponent(email)}`);
  }),
);

router.get(
  '/login/verify',
  asyncHandler(async (req, res) => {
    const { email } = req.query;
    if (!email) {
      setFlash(req, 'error', 'Sessão expirada, volte a inserir o email.');
      return res.redirect('/login');
    }
    return res.render('verify_otp', { title: 'Confirmar código', email });
  }),
);

router.post(
  '/login/verify-otp',
  asyncHandler(async (req, res) => {
    const { email, otp_code: otpCode } = req.body;
    if (!email || !otpCode) {
      setFlash(req, 'error', 'Dados em falta.');
      return res.redirect('/login');
    }

    const isValid = await verifyOtp(email, otpCode);
    if (!isValid) {
      setFlash(req, 'error', 'OTP inválido ou expirado.');
      return res.redirect(`/login/verify?email=${encodeURIComponent(email)}`);
    }

    const user = await findUserByEmail(email);
    if (!user) {
      setFlash(req, 'error', 'Utilizador não encontrado.');
      return res.redirect('/login');
    }

    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.userName = user.name;
    setFlash(req, 'success', 'Login efetuado.');
    return res.redirect('/dashboard');
  }),
);

router.get(
  '/logout',
  asyncHandler(async (req, res) => {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  }),
);

module.exports = router;
