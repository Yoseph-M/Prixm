const fs = require('fs');

function parseDotEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      env[match[1]] = match[2].replace(/^['"](.*)['"]$/, '$1');
    }
  });
  return env;
}

try {
  const envConfig = parseDotEnv('.env');
  const tsString = (value, fallback = '') => JSON.stringify(value || fallback);
  const envContent = `export const environment = {
  VITE_FIREBASE_API_KEY: ${tsString(envConfig.VITE_FIREBASE_API_KEY)},
  VITE_FIREBASE_AUTH_DOMAIN: ${tsString(envConfig.VITE_FIREBASE_AUTH_DOMAIN)},
  VITE_FIREBASE_PROJECT_ID: ${tsString(envConfig.VITE_FIREBASE_PROJECT_ID)},
  VITE_FIREBASE_STORAGE_BUCKET: ${tsString(envConfig.VITE_FIREBASE_STORAGE_BUCKET)},
  VITE_FIREBASE_MESSAGING_SENDER_ID: ${tsString(envConfig.VITE_FIREBASE_MESSAGING_SENDER_ID)},
  VITE_FIREBASE_APP_ID: ${tsString(envConfig.VITE_FIREBASE_APP_ID)},
  VITE_API_URL: ${tsString(envConfig.VITE_API_URL, 'http://localhost:8000')},
  VITE_COMPANY_ENRICH_API_KEY: ${tsString(envConfig.VITE_COMPANY_ENRICH_API_KEY)}
};`;

  if (!fs.existsSync('./src/environments')) {
    fs.mkdirSync('./src/environments', { recursive: true });
  }
  fs.writeFileSync('./src/environments/environment.ts', envContent);
  console.log('Environment file generated successfully.');
} catch (e) {
  console.error('Error generating environment file:', e);
}
