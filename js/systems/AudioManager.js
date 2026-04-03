// AudioManager — Web Audio API wrapper.
// Loads and plays SFX. Music loops via <audio> elements.
// All audio is gated by user interaction (iOS requirement).
//
// Asset files expected in /audio/sfx/*.mp3 and /audio/music/*.mp3
// If a file is missing, the play call fails silently.

import EventBus from '../core/EventBus.js'
import Logger   from '../core/Logger.js'
import { SETTINGS } from '../config.js'

const SFX_FILES = {
  flip:     'audio/sfx/flip.mp3',
  hit:      'audio/sfx/hit.mp3',
  spell:    'audio/sfx/spell.mp3',
  gold:     'audio/sfx/gold.mp3',
  levelup:  'audio/sfx/levelup.mp3',
  death:    'audio/sfx/death.mp3',
  shrine:   'audio/sfx/shrine.mp3',
  merchant: 'audio/sfx/merchant.mp3',
  retreat:  'audio/sfx/retreat.mp3',
}

const MUSIC_FILES = {
  dungeon: 'audio/music/dungeon.mp3',
  boss:    'audio/music/boss.mp3',
}

let _ctx        = null
let _sfxBuffers = {}
let _musicEl    = null  // current <audio> element for music
let _sfxVol     = SETTINGS.sfxVolume
let _musicVol   = SETTINGS.musicVolume
let _ready      = false

function init() {
  // Wire EventBus listeners
  EventBus.on('audio:play',    ({ sfx })   => playSfx(sfx))
  EventBus.on('audio:music',   ({ track }) => playMusic(track))
  EventBus.on('audio:stop',    ()          => stopMusic())
  EventBus.on('tile:revealed', ()          => playSfx('flip'))

  // Unlock AudioContext on first user interaction (iOS)
  const unlock = async () => {
    if (_ctx) return
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)()
      await _loadSfx()
      _ready = true
      Logger.debug('[AudioManager] AudioContext unlocked')
    } catch (e) {
      Logger.error('[AudioManager] AudioContext failed', e)
    }
    document.removeEventListener('touchstart', unlock)
    document.removeEventListener('click',      unlock)
  }
  document.addEventListener('touchstart', unlock, { once: true })
  document.addEventListener('click',      unlock, { once: true })
}

async function _loadSfx() {
  for (const [key, path] of Object.entries(SFX_FILES)) {
    try {
      const res  = await fetch(path)
      if (!res.ok) { Logger.debug(`[AudioManager] SFX missing: ${path}`); continue }
      const buf  = await res.arrayBuffer()
      _sfxBuffers[key] = await _ctx.decodeAudioData(buf)
    } catch {
      // Missing asset — play silently
    }
  }
}

function playSfx(key) {
  if (!_ready || !_ctx || !_sfxBuffers[key]) return
  try {
    const source = _ctx.createBufferSource()
    source.buffer = _sfxBuffers[key]
    const gain = _ctx.createGain()
    gain.gain.value = _sfxVol
    source.connect(gain)
    gain.connect(_ctx.destination)
    source.start()
  } catch (e) {
    Logger.error('[AudioManager] playSfx error', e)
  }
}

function playMusic(track) {
  stopMusic()
  const path = MUSIC_FILES[track]
  if (!path) return
  _musicEl = new Audio(path)
  _musicEl.loop   = true
  _musicEl.volume = _musicVol
  _musicEl.play().catch(() => {}) // fail silently if autoplay blocked
}

function stopMusic() {
  if (_musicEl) {
    _musicEl.pause()
    _musicEl.src = ''
    _musicEl = null
  }
}

function setVolumes({ sfx, music } = {}) {
  if (sfx   !== undefined) { _sfxVol   = sfx;   SETTINGS.sfxVolume   = sfx }
  if (music  !== undefined) {
    _musicVol = music
    SETTINGS.musicVolume = music
    if (_musicEl) _musicEl.volume = music
  }
}

export default { init, playSfx, playMusic, stopMusic, setVolumes }
