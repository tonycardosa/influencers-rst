async function isAuthenticated(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  return next();
}

async function isAdmin(req, res, next) {
  if (req.session.userRole !== 'admin') {
    return res.status(403).render('errors/403', {
      title: 'Acesso negado',
      message: 'Esta área está limitada a administradores RST.',
    });
  }
  return next();
}

module.exports = {
  isAuthenticated,
  isAdmin,
};
