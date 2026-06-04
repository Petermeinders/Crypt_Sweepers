import { readFileSync } from 'fs'

const path = process.argv[2] || 'docs/epics/the-void/void-selection-prototype.html'
const h = readFileSync(path, 'utf8')
const classes = new Set()
for (const m of h.matchAll(/class="([^"]+)"/g)) {
  for (const c of m[1].split(/\s+/)) {
    if (c.length < 50) classes.add(c)
  }
}
const pick = [...classes].filter(c =>
  /void|banner|vs-|bstat|pearl|tier|screen|footer|begin|back|header|particle|sway|triptych/i.test(c),
).sort()
console.log(pick.join('\n'))

const markers = ['class="banner-art"', 'class="vs-particles"', 'class="void-screen"', 'class="banner "']
for (const t of markers) {
  const i = h.indexOf(t)
  if (i < 0) { console.log('missing', t); continue }
  console.log('\n---', t, '---')
  console.log(h.slice(i, i + 2200).replace(/\s+/g, ' '))
}

// parse inline block-size / animation on first banner
const bi = h.indexOf('class="banner"')
if (bi >= 0) {
  const chunk = h.slice(bi, bi + 4000)
  for (const prop of ['block-size', 'inline-size', 'transform', 'animation', 'sway', '--sway', 'scale', 'opacity']) {
    const pi = chunk.indexOf(prop)
    if (pi >= 0) console.log(prop, ':', chunk.slice(pi, pi + 80).replace(/\s+/g, ' '))
  }
}
