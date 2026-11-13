// 소스 조각을 하나의 HTML로 합친다. node build.mjs [--local]
import fs from 'fs';
const dir = new URL('./src/', import.meta.url).pathname;
const files = fs.readdirSync(dir).sort();
const head = fs.readFileSync(dir + '00_head.html', 'utf8');
const js = files.filter(f => f.endsWith('.js')).map(f => `// ---- ${f} ----\n` + fs.readFileSync(dir + f, 'utf8')).join('\n');
// import 문은 모듈 최상단으로 끌어올린다
const imports = [], body = [];
js.split('\n').forEach(l => (/^import .* from '.*';$/.test(l) ? imports.push(l) : body.push(l)));
const out = head + '\n<script type="module">\n' + [...new Set(imports)].join('\n') + '\n' + body.join('\n') + '\n</script>\n';
fs.mkdirSync(new URL('./dist/', import.meta.url).pathname, { recursive: true });
fs.writeFileSync(new URL('./dist/engine.html', import.meta.url).pathname, out);
// 브라우저에서 바로 열거나 GitHub Pages로 배포할 수 있는 완전한 HTML 문서
const page = '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n' + out + '</body>\n</html>\n';
fs.mkdirSync(new URL('./docs/', import.meta.url).pathname, { recursive: true });
fs.writeFileSync(new URL('./docs/index.html', import.meta.url).pathname, page);
console.log('dist/engine.html', (out.length / 1024).toFixed(1) + ' KB · docs/index.html');
