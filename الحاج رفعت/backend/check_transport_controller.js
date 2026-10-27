const fs = require('fs');
let code = fs.readFileSync('src/controllers/transportController.js', 'utf8');
console.log(code.substring(0, 1000));
