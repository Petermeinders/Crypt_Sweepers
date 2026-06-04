import { readFileSync, writeFileSync } from 'fs'

const path = process.argv[2] || 'docs/epics/the-void/void-selection-prototype.html'
let s = readFileSync(path, 'utf8')
const m = s.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
if (!m) {
  console.error('no style')
  process.exit(1)
}
s = m[1]
// strip huge base64
s = s.replace(/url\([^)]*base64[^)]*\)/gi, 'url(stripped)')
s = s.replace(/data:[^;]+;base64,[A-Za-z0-9+/=]+/g, 'stripped')

const rules = []
for (const sel of [
  '.void-screen', '.void-back', '.void-content', '.void-header', '.void-titlewrap',
  '.void-eyebrow', '.void-title', '.void-titlerule', '.void-pearls',
  '.void-banners', '.banner', '.banner-art', '.banner-info', '.banner-name',
  '.bstat-tier', '.banner-stats', '.bstat', '.banner-flavor', '.banner-floors',
  '.banner-ring', '.banner-aura', '.banner-div', '.void-footer', '.void-begin',
  '.vs-particles', '.vs-shard', '.vs-vignette', '.vs-well', '.vs-wood', '.vs-swirl',
  '@keyframes',
]) {
  const re = sel.startsWith('@')
    ? /@keyframes\s+[\w-]+[\s\S]*?\}\s*\}/
    : new RegExp(sel.replace('.', '\\.') + '[^{]*\\{[^}]*\\}', 'g')
  if (sel.startsWith('@')) {
    const km = s.match(re)
    if (km) rules.push(km[0].slice(0, 800))
  } else {
    let match
    const r = new RegExp(sel.replace('.', '\\.') + '[^{]*\\{[^}]*\\}', 'g')
    while ((match = r.exec(s)) !== null && rules.length < 80) {
      if (match[0].length < 2000) rules.push(match[0])
    }
  }
}

const out = rules.join('\n\n')
writeFileSync('_working/void-prototype-extracted.css', out)
console.log('wrote', rules.length, 'rules,', out.length, 'chars')
console.log(out.slice(0, 8000))
