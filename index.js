const path = require('path');
const backendDir = path.join(__dirname, 'backend');
process.chdir(backendDir);
require(path.join(backendDir, 'index.js'));