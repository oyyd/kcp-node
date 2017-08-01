import { encrypt, decrypt } from '../encrypt'

const algorithm = 'aes-128-cbc'
const password = 'test'

describe('encrypt.js', () => {
  describe('encrypt&descrypt', () => {
    it('should encrypt and decrypt', () => {
      const originalData = Buffer.alloc(1024, 'ff', 'hex')
      const cph = encrypt(algorithm, password, originalData)

      expect(originalData.toString('hex')).not.toBe(cph.toString('hex'))

      const dcph = decrypt(algorithm, password, cph)
      expect(dcph.toString('hex')).toBe(originalData.toString('hex'))
    })
  })
})
