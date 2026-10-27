const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../../../frontend/src');

function getAllJsxFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            results = results.concat(getAllJsxFiles(fullPath));
        } else if (item.name.endsWith('.jsx') || item.name.endsWith('.js')) {
            results.push(fullPath);
        }
    }
    return results;
}

const files = getAllJsxFiles(srcDir);
console.log(`Found ${files.length} JSX/JS files in frontend/src.`);

const issues = [];

files.forEach(file => {
    const relPath = path.relative(srcDir, file);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
        const lineNum = index + 1;

        // Check for unguarded toISOString() on new Date()
        if (line.includes('new Date(') && line.includes('.toISOString()') && !line.includes('isValid') && !line.includes('try')) {
            // Check if it's new Date().toISOString() which is always safe vs new Date(var).toISOString()
            const matches = line.match(/new Date\(([^)]+)\)\.toISOString\(\)/g);
            if (matches) {
                matches.forEach(m => {
                    if (m !== 'new Date().toISOString()' && !m.includes('Date.now()')) {
                        issues.push({ file: relPath, lineNum, type: 'Potential Invalid Date toISOString', line: line.trim() });
                    }
                });
            }
        }

        // Check for unguarded toLowerCase on potentially null fields
        const toLowerMatch = line.match(/([a-zA-Z0-9_?.]+)\.toLowerCase\(\)/);
        if (toLowerMatch) {
            const expr = toLowerMatch[1];
            if (!expr.includes('||') && !expr.includes('?') && !expr.startsWith('String(') && expr !== 'str' && !expr.includes('e.target.value')) {
                // If it's something like t.driver_name.toLowerCase() without (t.driver_name || '')
                if (!line.includes(`(${expr} || '')`)) {
                    issues.push({ file: relPath, lineNum, type: 'Potential null.toLowerCase', line: line.trim() });
                }
            }
        }

        // Check for unguarded toLocaleString / toFixed on property
        const toFixedMatch = line.match(/\.([a-zA-Z0-9_]+)\.toFixed\(/);
        if (toFixedMatch && !line.includes('|| 0') && !line.includes('Number(') && !line.includes('parseFloat(')) {
            issues.push({ file: relPath, lineNum, type: 'Potential undefined.toFixed', line: line.trim() });
        }

        // Check for direct res.data assignment to array state
        if (line.includes('set') && line.includes('(res.data)') && !line.includes('Array.isArray')) {
            issues.push({ file: relPath, lineNum, type: 'Direct set(res.data) without Array.isArray', line: line.trim() });
        }
    });
});

console.log(`\n=== SCAN RESULTS (${issues.length} potential issues found) ===`);
issues.forEach(iss => {
    console.log(`[${iss.type}] ${iss.file}:${iss.lineNum}`);
    console.log(`   ${iss.line}\n`);
});
