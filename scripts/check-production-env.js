require('dotenv').config();
const { validateProductionEnvironment } = require('../src/config/environment');

try {
  validateProductionEnvironment(process.env);
  console.log('Production environment configuration is valid.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
