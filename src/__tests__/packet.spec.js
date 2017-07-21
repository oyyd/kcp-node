import { NetworkSimulator } from './network_simulator'
import { create, setWndSize, setOutput } from '../create'

describe('integration test', () => {
  let kcp1
  let kcp2
  let network

  beforeEach(() => {
    network = new NetworkSimulator()
    kcp1 = create(1)
    kcp2 = create(2)
  })

  it('should send one packet from a kcp and receive one from the other', () => {
    console.log('network', network)
  })
})
