import { create } from '../kcp'
import { setKCPMode } from '../mode'

describe('mode', () => {
  let kcp

  beforeEach(() => {
    kcp = create(0, 0)
  })

  it('should be okay', () => {
    setKCPMode(kcp, 'fast3')

    expect(kcp.nodelay).toBe(1)
    expect(kcp.interval).toBe(10)
    expect(kcp.fastresend).toBe(2)
    expect(kcp.nocwnd).toBe(1)
  })
})
