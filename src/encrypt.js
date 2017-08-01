/**
 * Provide encryptions of a certain method.
 *
 * NOTE: Check [this](https://github.com/ronomon/crypto-async) and make a benchmark.
 */
import crypto from 'crypto'

export function encrypt(algorithm, password, buf) {
  const cipher = crypto.createCipher(algorithm, password)

  return Buffer.concat([cipher.update(buf), cipher.final()])
}

export function decrypt(algorithm, password, buf) {
  const decipher = crypto.createDecipher(algorithm, password)
  decipher.setAutoPadding(true)

  return Buffer.concat([decipher.update(buf), decipher.final()])
}
