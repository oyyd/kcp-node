// TODO: open stream
import { setOptions } from './kcp'

const NAMES = [
  'nodelay',
  'interval',
  'fastresend',
  'nocwnd',
]

// nodelay, interval, fastresend, nocwnd
export const MODES = {
  normal: [0, 40, 2, 1],
  fast: [0, 30, 2, 1],
  fast2: [1, 20, 2, 1],
  fast3: [1, 10, 2, 1],
}

export function setKCPMode(kcp, mode = 'fast') {
  const modeArgs = MODES[mode]

  if (!modeArgs) {
    throw new Error(`invalid mode: ${mode}`)
  }

  const options = {}

  NAMES.forEach((key, i) => {
    options[key] = modeArgs[i]
  })

  return setOptions(kcp, options)
}
