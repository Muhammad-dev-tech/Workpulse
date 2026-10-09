/**
 * WorkPulse — Password Hash Generator
 * Usage: node backend/scripts/hash-password.js <password>
 * Example: node backend/scripts/hash-password.js mySecurePass123
 */
const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node hash-password.js <password>');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log('\nPassword :', password);
console.log('Hash     :', hash);
console.log('\nUse this hash in the SQL seed or UPDATE users SET password_hash = \'...\' WHERE email = \'...\';\n');
