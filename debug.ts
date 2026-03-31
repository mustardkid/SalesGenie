import fs from 'fs';
import path from 'path';
console.log('__dirname:', __dirname);
const p = path.join(__dirname, '..', 'public');
console.log('Public Path:', p);
try {
  console.log('Contents:', fs.readdirSync(p));
} catch (e) {
  console.error('Error:', e);
}
