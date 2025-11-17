const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { isAuthenticated } = require('../middleware/auth');
const {
  getTotalsForInfluencer,
  listCommissionsByInfluencer,
} = require('../services/commissionService');
const { listRulesByInfluencer } = require('../services/commissionRulesService');

const router = express.Router();

router.use(isAuthenticated);

router.get(
  '/reports',
  asyncHandler(async (req, res) => {
    const totals = await getTotalsForInfluencer(req.session.userId);
    res.render('influencer_reports', { title: 'Relatórios', totals });
  }),
);

router.get(
  '/reports/commissions',
  asyncHandler(async (req, res) => {
    const commissions = await listCommissionsByInfluencer(req.session.userId);
    res.render('influencer_commissions', { title: 'Comissões', commissions });
  }),
);

router.get(
  '/reports/rules',
  asyncHandler(async (req, res) => {
    const rules = await listRulesByInfluencer(req.session.userId);
    res.render('influencer_rules', { title: 'Regras', rules });
  }),
);

module.exports = router;
