const { findUserByEmail } = require('../services/userService');

const {
  AUTO_LOGIN_LOCAL = 'true',
  LOCAL_AUTO_LOGIN_EMAIL = 'tcardosa@outlook.com',
  NODE_ENV = 'development',
} = process.env;

function isLocalRequest(req) {
  const host = (req.hostname || '').toLowerCase();
  const ip = (req.ip || '').replace('::ffff:', '');
  const localHosts = new Set(['localhost', '127.0.0.1']);
  const localIps = new Set(['127.0.0.1', '::1']);
  return localHosts.has(host) || localIps.has(ip);
}

async function autoLoginLocal(req, res, next) {
  try {
    if (NODE_ENV === 'production') return next();
    if (AUTO_LOGIN_LOCAL === 'false') return next();
    if (req.session.userId) return next();
    if (!isLocalRequest(req)) return next();

    const user = await findUserByEmail(LOCAL_AUTO_LOGIN_EMAIL);
    if (user) {
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userName = user.name;
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = autoLoginLocal;
