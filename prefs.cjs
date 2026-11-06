const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const DEFAULTS = {
  autoUpdate: true,
}

function prefsPath() {
  return path.join(app.getPath('userData'), 'updater-prefs.json')
}

function readPrefs() {
  try {
    const raw = fs.readFileSync(prefsPath(), 'utf8')
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

function writePrefs( partial) {
  const next = { ...readPrefs(), ...partial }
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(prefsPath(), JSON.stringify(next, null, 2))
  return next
}

module.exports = { readPrefs, writePrefs, DEFAULTS }
