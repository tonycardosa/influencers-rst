const cron = require('node-cron');
const { syncOrders } = require('../services/commissionService');

const DEFAULT_SCHEDULE = '0 */2 * * *'; // every 2 hours at minute 0

function startOrderSyncJob() {
  const schedule = process.env.ORDER_SYNC_CRON || DEFAULT_SCHEDULE;
  let running = false;

  if (!cron.validate(schedule)) {
    console.error(`[orders-sync] invalid cron expression "${schedule}", skipping scheduler`);
    return;
  }

  cron.schedule(schedule, async () => {
    if (running) {
      // Prevent overlapping runs if a previous sync is still in progress
      console.log('[orders-sync] previous run still in progress, skipping tick');
      return;
    }

    running = true;
    console.log(`[orders-sync] starting scheduled sync (${new Date().toISOString()})`);

    try {
      const imported = await syncOrders();
      console.log(`[orders-sync] finished, imported ${imported} orders`);
    } catch (error) {
      console.error('[orders-sync] failed to sync orders:', error);
    } finally {
      running = false;
    }
  });

  console.log(`[orders-sync] scheduled with expression "${schedule}"`);
}

module.exports = {
  startOrderSyncJob,
};
