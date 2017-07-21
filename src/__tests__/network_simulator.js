import { getCurrent } from '../utils'

function random100() {
  return Math.random() * 100
}

export class NetworkSimulator {
  constructor(lostrate = 10, rttmin = 60, rttmax = 125, nmax = 1000) {
    this.current = getCurrent()
    this.lostrate = lostrate / 2
    this.rttmin = rttmin / 2
    this.rttmax = rttmax / 2
    this.nmax = nmax
    this.tx1 = 0
    this.tx2 = 0
    this.c12 = 0
    this.c21 = 0
    this.p12 = []
    this.p21 = []
  }

  send(peer, data) {
    if (peer === 0) {
      this.tx1 += 1
      if (random100() < this.lostrate || this.p12.length >= this.nmax) {
        return
      }
    } else {
      this.tx2 += 1
      if (random100() < this.lostrate || this.p21.length >= this.nmax) {
        return
      }
    }

    const current = getCurrent()

    const packet = {
      data,
      ts: current + Math.random() * (this.rttmax - this.rttmin),
    }

    if (peer === 0) {
      this.p12.push(packet)
    } else {
      this.p21.push(packet)
    }
  }

  recv(peer) {
    if (peer === 0 && this.p12.length === 0 || peer === 1 && this.p21.length === 0) {
      return -1
    }

    const c12 = this.c12 + 1
    const c21 = this.c21 + 1

    const packet = peer === 0 ? this.p12[c12] : this.p21[c21]
    const current = getCurrent()

    if (current < packet.ts) {
      return -2
    }

    // NOTE: this condition should never be true
    // if (maxsize < packet.size) {
    //   return -3
    // }

    const { data: d } = packet

    if (peer === 0) {
      this.p12[this.c12] = null
      this.c12 = c12
    } else {
      this.p21[this.c21] = null
      this.c21 = c21
    }

    return d
  }
}
