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
  flip:     'audio/sfx/flip.ogg',
  hit:      'audio/sfx/hit.mp3',
  hit2:     'audio/sfx/hit2.mp3',
  arrowShot: 'audio/sfx/arrow-shot.mp3',
  spell:    'audio/sfx/spell.ogg',
  gold:     'audio/sfx/gold.ogg',
  levelup:  'audio/sfx/levelup.ogg',
  death:    'audio/sfx/death.ogg',
  merchant: 'audio/sfx/merchant.ogg',
  retreat:  'audio/sfx/retreat.ogg',
  chest:    'audio/sfx/chest.ogg',
  trap:     'audio/sfx/trap.ogg',
  slam:     'audio/sfx/slam.mp3',
  heal:     'audio/sfx/heal.ogg',
  divineLight: 'audio/sfx/divine-light.mp3',
  menu:     'audio/sfx/menu.ogg',
  footsteps:'audio/sfx/footsteps.mp3',
  // Mage actives — reuse existing SFX until dedicated assets are added (avoids 404 in console).
  zap:             'audio/sfx/spell.ogg',
  telekineticSlam: 'audio/sfx/slam.mp3',
}

const MUSIC_FILES = {
  menu:    'audio/music/main-menu-theme.mp3',
  dungeon: 'audio/music/dungeon.mp3',
  boss:    'audio/music/boss.mp3',
}

let _ctx          = null
let _sfxBuffers   = {}
let _musicEl      = null  // current <audio> element for music
let _sfxVol       = SETTINGS.sfxVolume
let _musicVol     = SETTINGS.musicVolume
let _ready        = false
let _pendingTrack   = null  // track requested before user interaction
let _currentTrack   = null  // last track requested (for re-enable)
let _musicOn        = true
let _sfxOn          = true

function init() {
  // Wire EventBus listeners
  EventBus.on('audio:play',      (payload) => {
    if (payload?.layered) playSfxLayered(payload.sfx, payload.layered)
    else playSfx(payload?.sfx)
  })
  EventBus.on('audio:music',     ({ track })            => playMusic(track))
  EventBus.on('audio:crossfade', ({ track, duration })  => crossfadeTo(track, duration))
  EventBus.on('audio:stop',      ()                     => stopMusic())

  // Pause/resume music when app is backgrounded (Android Edge, PWA, etc.)
  document.addEventListener('visibilitychange', () => {
    if (!_musicEl) return
    if (document.hidden) {
      _musicEl.pause()
    } else if (_musicOn) {
      _musicEl.play().catch(() => {})
    }
  })

  // Unlock AudioContext on first user interaction (iOS)
  const unlock = async () => {
    if (_ctx) return
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)()
      await _loadSfx()
      _ready = true
      Logger.debug('[AudioManager] AudioContext unlocked')
      // Replay any music that was blocked before interaction
      if (_pendingTrack) { playMusic(_pendingTrack); _pendingTrack = null }
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
      if (!res.ok) { Logger.warn(`[AudioManager] SFX missing (${res.status}): ${key} → ${path}`); continue }
      const buf  = await res.arrayBuffer()
      _sfxBuffers[key] = await _ctx.decodeAudioData(buf)
    } catch (e) {
      Logger.warn(`[AudioManager] Failed to load SFX: ${key} → ${path}`, e)
    }
  }
}

function playSfx(key) {
  if (!_sfxOn || !_ready || !_ctx) return
  if (key === 'zap') { _synthesizeElectricalZap(); return }
  if (!_sfxBuffers[key]) return
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

/** Synthesize an electrical arc zap using Web Audio nodes — no asset file needed. */
function _synthesizeElectricalZap() {
  try {
    const t  = _ctx.currentTime
    const sr = _ctx.sampleRate

    // White noise burst (the crackling arc texture)
    const noiseDur = 0.30
    const noiseBuf = _ctx.createBuffer(1, Math.floor(sr * noiseDur), sr)
    const nd = noiseBuf.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
    const noise = _ctx.createBufferSource()
    noise.buffer = noiseBuf

    // Bandpass ~5 kHz — gives the sizzling high-frequency character
    const bpf = _ctx.createBiquadFilter()
    bpf.type = 'bandpass'
    bpf.frequency.value = 5000
    bpf.Q.value = 0.7

    // High-pass to remove low-frequency rumble
    const hpf = _ctx.createBiquadFilter()
    hpf.type = 'highpass'
    hpf.frequency.value = 1800

    const noiseEnv = _ctx.createGain()
    noiseEnv.gain.setValueAtTime(_sfxVol * 1.1, t)
    noiseEnv.gain.exponentialRampToValueAtTime(0.0001, t + noiseDur)

    // Low-frequency buzz (electrical hum of the arc)
    const buzz = _ctx.createOscillator()
    buzz.type = 'sawtooth'
    buzz.frequency.setValueAtTime(110, t)
    buzz.frequency.exponentialRampToValueAtTime(55, t + 0.14)
    const buzzEnv = _ctx.createGain()
    buzzEnv.gain.setValueAtTime(0, t)
    buzzEnv.gain.linearRampToValueAtTime(_sfxVol * 0.3, t + 0.003)
    buzzEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)

    // Short transient "crack" impulse at the very start
    const crackLen = Math.floor(sr * 0.010)
    const crackBuf = _ctx.createBuffer(1, crackLen, sr)
    const cd = crackBuf.getChannelData(0)
    for (let i = 0; i < crackLen; i++) {
      cd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (crackLen * 0.25))
    }
    const crack = _ctx.createBufferSource()
    crack.buffer = crackBuf
    const crackGain = _ctx.createGain()
    crackGain.gain.value = _sfxVol * 1.8

    // Wire up
    noise.connect(bpf)
    bpf.connect(hpf)
    hpf.connect(noiseEnv)
    noiseEnv.connect(_ctx.destination)

    buzz.connect(buzzEnv)
    buzzEnv.connect(_ctx.destination)

    crack.connect(crackGain)
    crackGain.connect(_ctx.destination)

    noise.start(t)
    noise.stop(t + noiseDur)
    buzz.start(t)
    buzz.stop(t + 0.16)
    crack.start(t)
  } catch (e) {
    Logger.error('[AudioManager] _synthesizeElectricalZap error', e)
  }
}

/** Multiple overlapping BufferSources from the same decoded buffer (rain / volley). */
function playSfxLayered(key, opts = {}) {
  if (!_sfxOn || !_ready || !_ctx || !_sfxBuffers[key]) return
  const buf = _sfxBuffers[key]
  const count = Math.max(1, Math.min(24, opts.count ?? 8))
  const spreadMs = opts.spreadMs ?? 0
  const jitterMs = opts.jitterMs ?? 45
  const spreadSec = spreadMs / 1000
  const jitterSec = jitterMs / 1000
  const pitchJitter = opts.pitchJitter !== false
  const t0 = _ctx.currentTime
  const perVoiceGain = _sfxVol / Math.sqrt(count)
  try {
    for (let i = 0; i < count; i++) {
      const spread =
        count <= 1 || spreadSec <= 0 ? 0 : (i / (count - 1)) * spreadSec
      const jit = (Math.random() * 2 - 1) * jitterSec
      const when = t0 + Math.max(0, spread + jit)
      const source = _ctx.createBufferSource()
      source.buffer = buf
      if (pitchJitter) source.playbackRate.value = 0.93 + Math.random() * 0.14
      const gain = _ctx.createGain()
      gain.gain.value = perVoiceGain
      source.connect(gain)
      gain.connect(_ctx.destination)
      source.start(when)
    }
  } catch (e) {
    Logger.error('[AudioManager] playSfxLayered error', e)
  }
}

function playMusic(track) {
  stopMusic()
  _currentTrack = track
  if (!_musicOn) return
  const path = MUSIC_FILES[track]
  if (!path) return
  _musicEl = new Audio(path)
  _musicEl.loop   = true
  _musicEl.volume = _musicVol
  _musicEl.play().catch(() => {
    // Autoplay blocked — remember track so it starts on first interaction
    _pendingTrack = track
  })
}

function stopMusic() {
  if (_musicEl) {
    _musicEl.pause()
    _musicEl.src = ''
    _musicEl = null
  }
}

function crossfadeTo(track, duration = 1500) {
  if (!_musicOn) { playMusic(track); return }
  const path = MUSIC_FILES[track]
  if (!path) return

  _currentTrack = track
  const outgoing = _musicEl
  const incoming = new Audio(path)
  incoming.loop   = true
  incoming.volume = 0
  incoming.play().catch(() => {})

  _musicEl = incoming

  const steps    = 30
  const interval = duration / steps
  let   step     = 0

  const tick = setInterval(() => {
    step++
    const t = step / steps
    if (outgoing) outgoing.volume = Math.max(0, _musicVol * (1 - t))
    incoming.volume = Math.min(_musicVol, _musicVol * t)
    if (step >= steps) {
      clearInterval(tick)
      if (outgoing) { outgoing.pause(); outgoing.src = '' }
    }
  }, interval)
}

function setMusicEnabled(on) {
  _musicOn = on
  if (!on) {
    stopMusic()
  } else {
    const track = _pendingTrack || _currentTrack
    if (track) { _pendingTrack = null; playMusic(track) }
  }
}

function setSfxEnabled(on) {
  _sfxOn = on
}

function setVolumes({ sfx, music } = {}) {
  if (sfx   !== undefined) { _sfxVol   = sfx;   SETTINGS.sfxVolume   = sfx }
  if (music  !== undefined) {
    _musicVol = music
    SETTINGS.musicVolume = music
    if (_musicEl) _musicEl.volume = music
  }
}

export default { init, playSfx, playSfxLayered, playMusic, stopMusic, crossfadeTo, setVolumes, setMusicEnabled, setSfxEnabled }
