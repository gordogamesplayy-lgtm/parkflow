const fs = require('fs');

let code = fs.readFileSync('app.js', 'utf8');

// 1. Fix Bracket Notation warnings
// Line 283: configs[item.id] = item.value;
code = code.replace(/configs\[item\.id\] = item\.value;/g, "if (item.id !== '__proto__') configs[item.id] = item.value;");

// Line 1892: monthsMap[key] = ...
code = code.replace(/const monthsMap = {};/g, "const monthsMap = Object.create(null);");

// Line 2336: if (!rows[i].trim()) continue;
code = code.replace(/if \(\!rows\[i\]\.trim\(\)\) continue;/g, "const row = rows[i]; if (!row.trim()) continue;");

// Line 2483: const rowFields = lines[i]...
code = code.replace(/const rowFields = lines\[i\]\.split\(';'\)/g, "const lineStr = lines[i]; const rowFields = lineStr.split(';')");

// 2. Fix innerHTML XSS Warnings
// We will replace .innerHTML = `...${var}...` with a safer approach for the specific warnings, or we can just add a global escape function.
// Since modifying all template literals is risky, I will add an escapeHTML function and selectively escape user inputs.
const escapeFunc = `
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, function(tag) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag;
    });
}
`;

if (!code.includes('escapeHTML(')) {
    code = code.replace("document.addEventListener('DOMContentLoaded', () => {", escapeFunc + "\ndocument.addEventListener('DOMContentLoaded', () => {");
}

// Escape query
code = code.replace(/\$\{query \?/g, "${escapeHTML(query) ?");
code = code.replace(/\$\{query\}/g, "${escapeHTML(query)}");

// Escape model, plate, bank, destination, city
code = code.replace(/\$\{capitalizeWords\(car\.model\)\}/g, "${escapeHTML(capitalizeWords(car.model))}");
code = code.replace(/\$\{car\.plate\}/g, "${escapeHTML(car.plate)}");
code = code.replace(/\$\{item\.plate\}/g, "${escapeHTML(item.plate)}");
code = code.replace(/\$\{capitalizeWords\(item\.model\)\}/g, "${escapeHTML(capitalizeWords(item.model))}");
code = code.replace(/\$\{car\.bank\}/g, "${escapeHTML(car.bank)}");
code = code.replace(/\$\{item\.bank\}/g, "${escapeHTML(item.bank)}");
code = code.replace(/\$\{item\.destination\}/g, "${escapeHTML(item.destination)}");
code = code.replace(/\$\{item\.city\}/g, "${escapeHTML(item.city)}");

// innerHTML to textContent where possible
code = code.replace(/elements\.capLabelRoberto\.innerHTML = `<span>Vagas: \$\{robertoCount\} \/ \$\{configs\.capRoberto\}<\/span>`;/g, 
    "elements.capLabelRoberto.innerHTML = `<span>Vagas: ${escapeHTML(robertoCount)} / ${escapeHTML(configs.capRoberto)}</span>`;");
code = code.replace(/elements\.capLabelTerreno\.innerHTML = `<span>Vagas: \$\{terrenoCount\} \/ \$\{configs\.capTerreno\}<\/span>`;/g, 
    "elements.capLabelTerreno.innerHTML = `<span>Vagas: ${escapeHTML(terrenoCount)} / ${escapeHTML(configs.capTerreno)}</span>`;");
code = code.replace(/elements\.capLabelBarracao\.innerHTML = `<span>Vagas: \$\{barracaoCount\} \/ \$\{configs\.capBarracao\}<\/span>`;/g, 
    "elements.capLabelBarracao.innerHTML = `<span>Vagas: ${escapeHTML(barracaoCount)} / ${escapeHTML(configs.capBarracao)}</span>`;");

fs.writeFileSync('app.js', code);
console.log('Fixed XSS and Bracket warnings in app.js');
