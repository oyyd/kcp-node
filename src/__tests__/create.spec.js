import { create, DEFAULT_KCPCB } from '../create'

describe('create.js', () => {
  describe('create', () => {
    it('should create an kcp instance with some specified keys', () => {
      const kcp = create(null, null)

      expect(Object.keys(kcp)).toEqual(Object.keys(DEFAULT_KCPCB))
    })
  })
})
