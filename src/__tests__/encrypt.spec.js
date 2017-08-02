import { createCipher, createDecipher } from '../encrypt'

const algorithm = 'aes-128-cbc'
const password = 'test'

describe('encrypt.js', () => {
  describe('createCipher & createDecipher', () => {
    it('should encrypt and decrypt', () => {
      const originalData = Buffer.alloc(1024, 'ff', 'hex')
      const cph = createCipher(algorithm, password, originalData)

      expect(originalData.toString('hex')).not.toBe(cph.toString('hex'))

      const dcph = createDecipher(algorithm, password, cph)
      expect(dcph.toString('hex')).toBe(originalData.toString('hex'))
    })
  })
})
