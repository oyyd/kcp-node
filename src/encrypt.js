/**
 * Provide encryptions of a certain method.
 *
 * This module will follow how kcp-go does.
 *
 * NOTE: Check [this](https://github.com/ronomon/crypto-async) and make a benchmark.
 */
import crypto from 'crypto'
import { crc32 } from 'crc'

const NONCE_SIZE = 16
const CRC_SIZE = 4

export const ENCRYPTED_EXPAND_SIZE = NONCE_SIZE + CRC_SIZE

export function createCipher(algorithm, password, buf) {
  const cipher = crypto.createCipher(algorithm, password)

  return Buffer.concat([cipher.update(buf), cipher.final()])
}

export function createDecipher(algorithm, password, buf) {
  const decipher = crypto.createDecipher(algorithm, password)

  return Buffer.concat([decipher.update(buf), decipher.final()])
}

export function encrypt(algorithm, password, buf) {
  const crcBuf = Buffer.allocUnsafe(CRC_SIZE)
  crcBuf.writeUInt32BE(crc32(buf))

  const ciphered = createCipher(algorithm, password, Buffer.concat([
    crypto.randomBytes(NONCE_SIZE),
    crcBuf,
    buf,
  ]))

  return ciphered
}

export function decrypt(algorithm, password, buf) {
  const deciphered = createDecipher(algorithm, password, buf)
  const crcValue = deciphered.readUInt32BE(NONCE_SIZE)
  const contentBuf = deciphered.slice(ENCRYPTED_EXPAND_SIZE)

  if (crcValue !== crc32(contentBuf)) {
    return false
  }

  return contentBuf
}
