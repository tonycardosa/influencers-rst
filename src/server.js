require('dotenv').config();
const bootstrap = require('./config/bootstrap');
const { startOrderSyncJob } = require('./jobs/orderSyncJob');

async function start() {
  await bootstrap();
  // carregar app apenas depois do bootstrap concluir
  const app = require('./app');
  const PORT = process.env.PORT || 3000;

  startOrderSyncJob();

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`RST Ferramentas dashboard disponível em http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});
