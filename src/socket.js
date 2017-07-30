/**
 * Provide reliable stream communication by kcp.
 *
 * A kcp socket is a duplex stream in nodejs.
 */
import { Duplex } from 'stream'
import { defaultUpdater } from './updater'
import {
  create as createKCP,
  setOutput,
  IKCP_OVERHEAD,
  setMtu,
  input,
  send,
  recv,
  getCurrent,
  check as checkKCP,
  update as updateKCP,
} from './kcp'

// TODO: timeout and buf
export class KCPSocket extends Duplex {
  constructor(duplexOptions, socketOptions) {
    super(duplexOptions)

    const { pool, remoteAddr, remotePort } = socketOptions

    this.closed = false
    this.changed = false
    this.tsFlush = 0
    this.remoteAddr = remoteAddr
    this.remotePort = remotePort
    this.pool = pool
    this.conv = this.pool.newConv(remotePort, remoteAddr)
    this.kcp = createKCP(this.conv)

    // bind kcp
    this.pool.listenRemote(remotePort, remoteAddr, this.conv, (buf) => {
      input(this.kcp, buf)
    })

    setOutput(this.kcp, data => {
      this.pool.send(data, this.remotePort, this.remoteAddr)
    })

    defaultUpdater.addSocket(this)
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

  close() {
    this.closed = true
    // TODO: release conv
    // TODO: release pool listening
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

  _read() {
    const d = recv(this.kcp)

    if (d === -1 || d === -2) {
      return
    }

    this.push(d)
  }

  end() {

  }
}
