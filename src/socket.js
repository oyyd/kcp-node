/**
 * Provide reliable stream communications by kcp.
 *
 * A kcp socket is a duplex stream in nodejs.
 */
import { Duplex } from 'stream'
import { defaultUpdater } from './updater'
import {
  // IKCP_OVERHEAD,
  create as createKCP,
  setOutput,
  input,
  send,
  recv,
  check as checkKCP,
  update as updateKCP,
  setMtu,
  setWndSize,
} from './kcp'
import { setKCPMode } from './mode'

const DEFAULT_TIMEOUT = 10000
const DEFAULT_WND_SIZE = 128

export class KCPSocket extends Duplex {
  constructor(duplexOptions, socketOptions) {
    super(duplexOptions)

    const {
      // required
      pool,
      // required
      remoteAddr,
      // required
      remotePort,
      // optional
      conv,
      // optional
      user = 'socket',
      // optional
      timeout,
      // optional
      mode,
    } = socketOptions

    this.allowPush = false
    this.user = user
    this.timeout = timeout || DEFAULT_TIMEOUT
    this.closed = false
    this.changed = false
    this.tsFlush = 0
    this.remoteAddr = remoteAddr
    this.remotePort = remotePort
    this.pool = pool
    this.timer = null
    this.conv = this.pool.newConv(remotePort, remoteAddr, conv)

    // init kcp
    this.kcp = createKCP(this.conv, user)
    this.onMessage = this.onMessage.bind(this)
    setWndSize(this.kcp, DEFAULT_WND_SIZE, DEFAULT_WND_SIZE)
    setKCPMode(this.kcp, mode)
    setMtu(this.kcp, this.pool.kcpMTUSize)

    // bind kcp
    if (user === 'socket') {
      this.pool.listenRemote(remotePort, remoteAddr, this.onMessage)
    }

    setOutput(this.kcp, data => {
      // if (user !== 'socket') {
      //   console.log('output', data.length / IKCP_OVERHEAD, data.toString('hex'))
      // }
      this.pool.send(data, this.remotePort, this.remoteAddr)
    })

    // checking timer
    defaultUpdater.addSocket(this)

    // timeout
    this.resetTimeout()
  }

  close(errStr = null) {
    const { user, remotePort, remoteAddr, conv } = this

    if (this.timer) {
      clearTimeout(this.timer)
    }

    this.closed = true
    this.pool.deleteConv(remotePort, remoteAddr, conv)
    if (user === 'socket') {
      this.pool.removeListener(remotePort, remoteAddr, this.onMessage)
    }

    // TODO: close kcp
    // TODO: duplex
    // this.destroy(err)
    this.emit('close', errStr)
  }

  resetTimeout() {
    if (this.timer) {
      clearTimeout(this.timer)
    }

    this.timer = setTimeout(() => {
      if (!this.closed) {
        this.close('timeout')
      }
    }, this.timeout)
  }

  onMessage({ conv, data }) {
    if (conv === this.conv) {
      // console.log('onMessage', this.user, data)
      // TODO: check response code
      input(this.kcp, data)
      this.tryToPush()
      this.resetTimeout()
    }
  }

  update(current) {
    const { changed } = this

    // the `tsFlush` should be ingored and the `update/flush` should be called immediately
    // if it's `changed` by ikcp_send or ikcp_input
    if (!changed) {
      if (this.tsFlush === 0) {
        const ts = checkKCP(this.kcp, current)
        this.tsFlush = ts
      }

      if (current >= this.tsFlush) {
        this.tsFlush = 0
        updateKCP(this.kcp, current)
      }
    } else {
      this.tsFlush = 0
      this.changed = false
      updateKCP(this.kcp, current)
    }
  }

  tryToPush() {
    if (!this.allowPush) {
      return
    }

    const d = recv(this.kcp)

    if (d === -1 || d === -2) {
      return
    }

    if (!this.push(d)) {
      this.allowPush = false
    }
  }

  // NOTE: we only accept buffer currently
  _write(buffer, encoding, callback) {
    const { kcp } = this
    const times = Math.ceil(buffer.length / kcp.mss)
    let err = null

    // TODO: disable `frg` would be much more efficient
    for (let i = 0; i < times; i += 1) {
      const res = send(kcp, buffer.slice(kcp.mss * i, kcp.mss * (i + 1)))
      if (res !== 0) {
        err = new Error(`invalid write: ${res}`)
        break
      }
    }

    callback(err)
  }

  // NOTE: stream is ready for receive data
  _read() {
    this.allowPush = true
    this.tryToPush()
  }
}
