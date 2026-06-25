import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { session } from '../../js/core/RunContext.js'
import { mergeEquippedGemsForResume, resolveEquippedGemsForDisplay } from '../../js/controllers/GemController.js'

describe('gem meta persistence helpers', () => {
  test('mergeEquippedGemsForResume prefers active run sockets over empty save', () => {
    session.save = { equippedGems: { block: null, counter: null } }
    session.run = { equippedGems: { block: 'gem-fortress-stone', counter: 'gem-riposte-ruby' } }
    assert.deepEqual(mergeEquippedGemsForResume(session.run.equippedGems), {
      block: 'gem-fortress-stone',
      counter: 'gem-riposte-ruby',
    })
  })

  test('mergeEquippedGemsForResume falls back to meta save when run snapshot is empty', () => {
    session.save = { equippedGems: { block: 'gem-steadfast-shard', counter: null } }
    session.run = { equippedGems: { block: null, counter: null } }
    assert.deepEqual(mergeEquippedGemsForResume(session.run.equippedGems), {
      block: 'gem-steadfast-shard',
      counter: null,
    })
  })

  test('resolveEquippedGemsForDisplay falls back to save when run socket empty', () => {
    session.save = { equippedGems: { block: 'gem-wardens-opal', counter: null } }
    session.run = { equippedGems: { block: null, counter: null } }
    assert.deepEqual(resolveEquippedGemsForDisplay(), {
      block: 'gem-wardens-opal',
      counter: null,
    })
  })
})
