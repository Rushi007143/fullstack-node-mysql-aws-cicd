const app = require('./app');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Node.js backend running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  server.close(async () => {
    if (app.closeConnections) await app.closeConnections();
    process.exit(0);
  });
});
