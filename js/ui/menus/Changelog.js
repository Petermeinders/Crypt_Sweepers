import { CHANGELOG } from '../../data/changelog.js'

function _changelogTagClass(tag) {
  const map = {
    New: 'new',
    Hero: 'hero',
    Mage: 'mage',
    Balance: 'balance',
    Progress: 'progress',
    Combat: 'combat',
    World: 'world',
    Meta: 'meta',
    UI: 'ui',
    Systems: 'systems',
    Audio: 'audio',
  }
  return map[tag] ?? 'misc'
}

/** Render changelog cards into #changelog-entries (idempotent). */
export function renderChangelogEntries() {
  const root = document.getElementById('changelog-entries')
  if (!root || root.dataset.rendered === '1') return
  root.dataset.rendered = '1'
  const articles = CHANGELOG.map(entry => {
    const ver = entry.version
      ? `<span class="update-card__ver">${entry.version}</span>`
      : ''
    const dt = entry.dateIso ? ` datetime="${entry.dateIso}"` : ''
    const items = entry.items.map(it => `
          <li class="update-list__item">
            <span class="update-tag update-tag--${_changelogTagClass(it.tag)}">${it.tag}</span>
            <span class="update-list__text">${it.text}</span>
          </li>`).join('')
    return `
    <article class="update-card">
      <div class="update-card__meta">
        <time class="update-card__date"${dt}>${entry.dateLabel}</time>
        ${ver}
      </div>
      <h2 class="update-card__title">${entry.title}</h2>
      <p class="update-card__summary">${entry.summary}</p>
      <ul class="update-list">${items}</ul>
    </article>`
  }).join('')
  root.innerHTML = articles
    + '<p class="updates-footnote">Earlier builds may not appear here — this is a highlights reel, not a full change log.</p>'
}
