// TODO: should make a udp connection pools?
import dgram from 'dgram'
import EventEmitter from 'events'
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

export function changeFlushStatus(sess, tsFlush, changed) {
  if (tsFlush !== null) {
    sess.tsFlush = tsFlush
  }

  if (changed !== null) {
    sess.changed = changed
  }
}

// @private
export function encodeBuf() {

}

// @private
export function decodeBuf() {

}

// Output data (of kcp) into udp.
// @private
export function output(sess, buf /* kcp, user */) {
  const { udp, port, address } = sess

  // TODO: encode

  return udp.send(buf, port, address)
}

// Try to call `update` of kcp and prevent it if possible
// according to the `tsFlush` and `changed`.
// @private
export function update(sess) {
  const { changed } = sess
  // TODO: the `getCurrent` would be called too often. Check its performance
  const current = getCurrent()

  // the `tsFlush` should be ingored and the `update/flush` should be called immediately
  // if it's `changed` by ikcp_send or ikcp_input
  if (!changed) {
    if (sess.tsFlush === 0) {
      const ts = checkKCP(sess.kcp, current)
      changeFlushStatus(sess, ts, null)
    }

    if (current >= sess.tsFlush) {
      changeFlushStatus(sess, 0, null)
      updateKCP(sess.kcp, current)
    }
  } else {
    changeFlushStatus(sess, 0, false)
    updateKCP(sess.kcp, current)
  }
}

// TODO: api
// @private
export function sessionBind(sess, ...args) {
  const { udp, kcp } = sess

  udp.on('message', (buf) => {
    // TODO: decode
    input(kcp, buf)
    changeFlushStatus(kcp, null, true)

    const d = recv(kcp)

    if (d === -1 || d === -2) {
      // TODO: record errors
      return
    }

    sess.emit('message', d)
  })

  udp.on('error', (err) => sess.emit('error', err))

  // TODO: server may not finish binding
  udp.bind(...args)
}

// TODO:
// @private
export function sessionSend(sess, buf, port, address) {
  sess.port = port
  sess.address = address

  const { kcp } = sess

  // TODO: decode buf
  send(kcp, buf)
}

export function createSession(conv) {
  const kcp = createKCP(conv)

  // TODO: laddr, local port, remote port
  const udp = dgram.createSocket('udp4')

  // TODO: extends send
  const headerSize = 0
  const sess = new EventEmitter()

  Object.assign(sess, {
    kcp,
    headerSize,
    // from kcp.check()
    tsFlush: 0,
    udp,
    address: udp.address.bind(udp),
    send: sessionSend.bind(null, sess),
    bind: sessionBind.bind(null, sess),
    update: update.bind(null, sess),
  })

  setOutput(kcp, output.bind(null, sess))

  // create kcp
  // setOutput(kcp, output)
  setMtu(kcp, IKCP_OVERHEAD - headerSize)

  // TODO: support customized updater
  defaultUpdater.addSession(sess)

  return sess
}

// Accept udp connections, decrypt contents(for auth),
// create a new udp session ready for sending back
export function createServer() {

}
