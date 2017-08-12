import { getCurrent } from '../utils'
// import { decode } from './utils'

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
    this.p12 = []
    this.p21 = []
  }

  send(peer, data, norandom) {
    if (peer === 0) {
      this.tx1 += 1
      if (!norandom && (random100() < this.lostrate
        || this.p12.length >= this.nmax)) {
        return
      }
    } else {
      this.tx2 += 1
      if (!norandom && (random100() < this.lostrate
        || this.p21.length - this.c21 - 1 >= this.nmax)) {
        return
      }
    }

    const current = getCurrent()

    const packet = {
      data: Buffer.from(data),
      ts: current + this.rttmin + Math.round(Math.random() * (this.rttmax - this.rttmin)),
    }

    if (peer === 0) {
      this.p12.push(packet)
    } else {
      this.p21.push(packet)
    }
  }

  recv(peer, current = getCurrent()) {
    if ((peer === 0 && this.p21.length === 0)
      || (peer === 1 && this.p12.length === 0)) {
      return -1
    }

    const group = peer === 1 ? this.p12 : this.p21
    const { length } = group
    let i = 0

    for (; i < length; i += 1) {
      const packet = group[i]

      if (current < packet.ts) {
        break
      }
    }

    if (i === 0) {
      return -2
    }

    const d = Buffer.concat(group.slice(0, i).map(i => i.data))

    if (peer === 1) {
      this.p12 = this.p12.slice(i)
    } else {
      this.p21 = this.p21.slice(i)
    }

    return d
  }

  clear(peer) {
    if (peer === 0) {
      this.p21 = []
      this.tx1 = 0
    }

    if (peer === 1) {
      this.p12 = []
      this.tx2 = 0
    }
  }
}
