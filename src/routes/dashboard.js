const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { isAuthenticated } = require('../middleware/auth');
const {
  getTotalsForAdmin,
  getTotalsForInfluencer,
} = require('../services/commissionService');

const router = express.Router();

router.get(
  '/dashboard',
  isAuthenticated,
  asyncHandler(async (req, res) => {
    if (req.session.userRole === 'admin') {
      const totals = await getTotalsForAdmin();
      return res.render('admin_dashboard', { title: 'Dashboard', totals });
    }

    const totals = await getTotalsForInfluencer(req.session.userId);
    return res.render('influencer_dashboard', { title: 'Dashboard', totals });
  }),
);

module.exports = router;
