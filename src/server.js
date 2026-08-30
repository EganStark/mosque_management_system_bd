require('dotenv').config();
const app = require('./app');
const landingPublishing = require('./services/landing-publishing');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Mosque Management admin running on http://localhost:${PORT}`);
  landingPublishing.publishDue().catch((error) => console.error('Scheduled publishing failed:', error));
});

const publishingTimer = setInterval(() => landingPublishing.publishDue().catch((error) => console.error('Scheduled publishing failed:', error)), 60 * 1000);
publishingTimer.unref();

process.on('SIGTERM', () => { clearInterval(publishingTimer); server.close(); });
process.on('SIGINT', () => { clearInterval(publishingTimer); server.close(() => process.exit(0)); });

module.exports = server;
