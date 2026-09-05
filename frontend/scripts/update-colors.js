const fs = require('fs');
const pathAgro = '/home/qwerty/PROJETS/si-tcha-ai-mobile/frontend/src/app/(seller)/agronomist.tsx';
let contentAgro = fs.readFileSync(pathAgro, 'utf8');

// Replace old colors in agronomist.tsx
contentAgro = contentAgro.replace(/color="#f3ecd8"/g, 'color="#F8FAFC"');
contentAgro = contentAgro.replace(/color="#d97834"/g, 'color="#0EA5E9"');
contentAgro = contentAgro.replace(/color="#101e0f"/g, 'color="#0F172A"');
contentAgro = contentAgro.replace(/color="#b45309"/g, 'color="#0284C7"');
contentAgro = contentAgro.replace(/color=\{hasPhoto \? '#15803d' : '#d97834'\}/g, "color={hasPhoto ? '#22C55E' : '#0EA5E9'}");

fs.writeFileSync(pathAgro, contentAgro);
console.log('agronomist.tsx colors updated');

const pathHome = '/home/qwerty/PROJETS/si-tcha-ai-mobile/frontend/src/app/(seller)/home.tsx';
let contentHome = fs.readFileSync(pathHome, 'utf8');

contentHome = contentHome.replace(/color="#f3ecd8"/g, 'color="#F8FAFC"');
contentHome = contentHome.replace(/color="#d97834"/g, 'color="#0EA5E9"');
contentHome = contentHome.replace(/color="#101e0f"/g, 'color="#0F172A"');
contentHome = contentHome.replace(/color="#889e87"/g, 'color="#64748B"');
contentHome = contentHome.replace(/backgroundColor="#101e0f"/g, 'backgroundColor="#0F172A"');

fs.writeFileSync(pathHome, contentHome);
console.log('home.tsx colors updated');
