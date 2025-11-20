const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { isAuthenticated } = require('../middleware/auth');
const {
  getTotalsForAfiliado,
  listCommissionsByAfiliado,
} = require('../services/commissionService');
const { listRulesByAfiliado } = require('../services/commissionRulesService');

const router = express.Router();

router.use(isAuthenticated);

router.get(
  '/reports',
  asyncHandler(async (req, res) => {
    const totals = await getTotalsForAfiliado(req.session.userId);
    res.render('influencer_reports', { title: 'Relatórios', totals });
  }),
);

router.get(
  '/reports/commissions',
  asyncHandler(async (req, res) => {
    const commissions = await listCommissionsByAfiliado(req.session.userId);
    res.render('influencer_commissions', { title: 'Comissões', commissions });
  }),
);

router.get(
  '/reports/rules',
  asyncHandler(async (req, res) => {
    const rules = await listRulesByAfiliado(req.session.userId);
    res.render('influencer_rules', { title: 'Regras', rules });
  }),
);

module.exports = router;
