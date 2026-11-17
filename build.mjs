// Concatenate the source fragments into a single HTML file, then generate the Korean edition.
//   node build.mjs  →  dist/engine.html, docs/index.html (English), docs/ko.html (Korean)
import fs from 'fs';
const root = new URL('./', import.meta.url).pathname;
const dir = root + 'src/';
const files = fs.readdirSync(dir).sort();
const head = fs.readFileSync(dir + '00_head.html', 'utf8');
const js = files.filter(f => f.endsWith('.js')).map(f => `// ---- ${f} ----\n` + fs.readFileSync(dir + f, 'utf8')).join('\n');
// Hoist import statements to the top of the module
const imports = [], body = [];
js.split('\n').forEach(l => (/^import .* from '.*';$/.test(l) ? imports.push(l) : body.push(l)));
const out = head + '\n<script type="module">\n' + [...new Set(imports)].join('\n') + '\n' + body.join('\n') + '\n</script>\n';

// ---- Korean edition ----
// i18n/ko.json maps each English UI string (as it appears between quotes, tags or braces) to Korean.
// English reference names (`en: '…'` fields and the third element of part rows) are kept in English.
const KO = JSON.parse(fs.readFileSync(root + 'i18n/ko.json', 'utf8'));
const SKIP = new Set(['a', 'calc', 'edu', 'ref', 'none']);          // also used as code identifiers
const LEAD = /^[\s/\-=*·,:;.|>+]*/;
function toKorean(src) {
  const keep = [];
  const hold = v => { keep.push(v); return '\u0000' + (keep.length - 1) + '\u0000'; };
  src = src
    .replace(/<html lang="en">/, '<html lang="ko">')
    .replace("const LANG = 'en';", "const LANG = 'ko';")
    .replace('family=IBM+Plex+Sans:wght', 'family=IBM+Plex+Sans+KR:wght')
    .replace('--sans:"IBM Plex Sans", system-ui,', '--sans:"IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui,')
    .replace(/<a class="tbtn" id="langBtn"[^>]*>[^<]*<\/a>/, () => hold('<a class="tbtn" id="langBtn" href="index.html" hreflang="en" lang="en" title="View in English">English</a>'))
    .replace(/<nav class="mtabs"[\s\S]*?<\/nav>/, () => hold('<nav class="mtabs" id="mtabs" role="tablist" aria-label="패널">\n    <button role="tab" data-t="views">보기</button><button role="tab" data-t="devices">기기</button><button role="tab" data-t="parts">부품</button><button role="tab" data-t="state">상태</button><button role="tab" data-t="info">정보</button>\n  </nav>'))
    .replace(/(\ben: )'([^'\n]*)'/g, (m, a, v) => a + "'" + hold(v) + "'")
    .replace(/^(\s*\['[a-z0-9_]+', '[^'\n]*', )'([^'\n]*)'/gm, (m, a, v) => a + "'" + hold(v) + "'");
  src = src.split('\n').map(line => line.replace(/[^'"`<>\n{}\u0000]+/g, seg => seg.split(/(\/\/|\/\*|\*\/)/).map(part => {
    if (part === '//' || part === '/*' || part === '*/') return part;
    const lead = part.match(LEAD)[0], rest = part.slice(lead.length), core = rest.replace(/\s+$/, '');
    return core && !SKIP.has(core) && Object.hasOwn(KO, core) ? lead + KO[core] + rest.slice(core.length) : part;
  }).join(''))).join('\n');
  // Korean particles attach directly to a bold term: "<b>X</b> 을" → "<b>X</b>을"
  src = src.replace(/<\/b>,?\s+(?=(?:을|를|이|가|은|는|의|에|와|과|으로|로|입니다)[\s.,)]|\()/g, '</b>');
  return src.replace(/\u0000(\d+)\u0000/g, (m, i) => keep[+i]);
}

const page = html => '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n' + html + '</body>\n</html>\n';
fs.mkdirSync(root + 'dist/', { recursive: true });
fs.mkdirSync(root + 'docs/', { recursive: true });
fs.writeFileSync(root + 'dist/engine.html', out);
fs.writeFileSync(root + 'docs/index.html', page(out));
fs.writeFileSync(root + 'docs/ko.html', toKorean(page(out)));
console.log('dist/engine.html', (out.length / 1024).toFixed(1) + ' KB · docs/index.html · docs/ko.html');
