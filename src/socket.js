/**
 * Provide reliable stream communication by kcp.
 *
 * A kcp socket is a duplex stream in nodejs.
 */
import { Duplex } from 'stream'
import { createPool } from './pool'
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
  }

  close() {
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
