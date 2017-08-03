/**
 * Provide reliable stream communications by kcp.
 *
 * A kcp socket is a duplex stream in nodejs.
 */
import { Duplex } from 'stream'
import { defaultUpdater } from './updater'
import {
  create as createKCP,
  setOutput,
  input,
  send,
  recv,
  check as checkKCP,
  update as updateKCP,
  setMtu,
} from './kcp'
import { setKCPMode } from './mode'

const DEFAULT_TIMEOUT = 10000

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
    setKCPMode(this.kcp)
    setMtu(this.kcp, this.pool.kcpMTUSize)

    // bind kcp
    if (user === 'socket') {
      this.pool.listenRemote(remotePort, remoteAddr, this.onMessage)
    }

    setOutput(this.kcp, data => {
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

  // NOTE: now we only accept buffer
  _write(chunk, encoding, callback) {
    const { kcp } = this

    // TODO: handle error
    const res = send(kcp, chunk)
    let err = null

    if (res !== 0) {
      err = new Error(`invalid write ${res}`)
    }

    callback(err)
  }

  // NOTE: stream is ready for receive data
  _read() {
    this.allowPush = true
    this.tryToPush()
  }
}
