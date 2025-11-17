const path = require('path');
const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const autoLoginLocal = require('./middleware/autoLoginLocal');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const influencerRoutes = require('./routes/influencer');

const app = express();

app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layout');
app.use(expressLayouts);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'rst-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 4 }, // 4 hours
  }),
);

app.use(autoLoginLocal);

app.use((req, res, next) => {
  res.locals.currentUser = {
    id: req.session.userId,
    name: req.session.userName,
    role: req.session.userRole,
  };
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  res.locals.layoutLogo =
    'https://rstferramentas.com/img/logo-1714841361.jpg';
  next();
});

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(adminRoutes);
app.use(influencerRoutes);

app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Página não encontrada' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // TODO: substituir por logging centralizado
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).render('errors/500', {
    title: 'Erro inesperado',
    message: err.message,
  });
});

module.exports = app;
