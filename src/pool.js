/**
 * Pool manage udp connections for:
 * 1. Sockets with a same destination don't bind extral local ports.
 * 2. Support crc, fec, data encoding/decoding.
 * 3. Manage kcp conv.
 */
import dgram from 'dgram'
import { warn } from './log'
import { getConv } from './kcp'

// TODO: how to delete unused udp sockets
const MAX_INT32 = 2147483647
const WARN_LIMIT = 3000
const WARN_LISTENER_LIMIT = 3000

// @private
export function encodeBuf() {

}

// @private
export function decodeBuf() {

}

// @private
export function getId(port, address, local) {
  return `${local ? 'l' : 'r'} ${port}:${address}`
}

function createKCPSocket() {
  const socket = dgram.createSocket('udp4')

  socket.setMaxListeners(WARN_LISTENER_LIMIT)

  socket.on('message', (d, rinfo) => {
    // TODO: decode
    const conv = getConv(d)

    // TODO: do not need to decode if there is no listener
    socket.emit('kcp_msg', {
      conv,
      data: d,
    }, rinfo)
  })

  return socket
}

function getOrCreateSocket(pool, id) {
  const { connections } = pool
  let socket
  if (connections[id]) {
    socket = connections[id]
  } else {
    socket = createKCPSocket()
    connections[id] = socket
    pool.connCounts += 1

    if (pool.connCounts > WARN_LIMIT) {
      warn(`Too many udp sockets: ${pool.connCounts}`)
    }
  }
  return socket
}

export function listen(pool, localPort, onMessage, onListen) {
  const localAddr = '127.0.0.1'
  const id = getId(localPort, localAddr, true)

  const socket = getOrCreateSocket(pool, id)

  socket.bind(localPort, onListen)

  // TODO: error handleing
  // TODO: decode
  socket.on('kcp_msg', onMessage)

  return socket
}

export function listenRemote(pool, remotePort, remoteAddr, onMessage) {
  const id = getId(remotePort, remoteAddr, false)
  const socket = getOrCreateSocket(pool, id)

  socket.on('kcp_msg', onMessage)
}

export function removeListener(pool, remotePort, remoteAddr, onMessage) {
  const id = getId(remotePort, remoteAddr, false)
  const socket = getOrCreateSocket(pool, id)

  socket.removeListener('kcp_msg', onMessage)
}

export function removeSocket(pool, port, address, local) {
  const id = getId(port, address, local)
  const socket = pool.connections[id]

  if (socket) {
    socket.close()
    delete pool.connections[id]
    pool.connCounts -= 1
    return true
  }

  return false
}

export function getSocket(pool, remotePort, remoteAddr) {
  const id = getId(remotePort, remoteAddr, false)
  const socket = getOrCreateSocket(pool, id)

  return socket
}

export function send(pool, data, remotePort, remoteAddr, done) {
  const socket = getSocket(pool, remotePort, remoteAddr)

  // TODO: encode
  socket.send(data, remotePort, remoteAddr, done)

  return socket
}

export function clear(pool) {
  const { connections } = pool

  Object.keys(connections).forEach((id) => {
    const socket = connections[id]

    socket.close()
  })
}

export function newConv(pool, remotePort, remoteAddr, conv) {
  const id = getId(remotePort, remoteAddr)
  // NOTE: init socket
  pool.getSocket(remotePort, remoteAddr)

  if (!pool.kcpConv[id]) {
    pool.kcpConv[id] = {
      nextConv: 0,
    }
  }

  const socketConv = pool.kcpConv[id]
  let nextConv

  if (typeof conv === 'number') {
    nextConv = conv
  } else {
    nextConv = socketConv.nextConv
  }

  socketConv[nextConv] = true

  let next = nextConv + 1

  if (next === MAX_INT32) {
    next = 0
  }

  for (let i = next; i < MAX_INT32; i += 1) {
    if (!socketConv[i]) {
      next = i
      break
    }
  }

  socketConv.nextConv = next

  return nextConv
}

export function deleteConv(pool, remotePort, remoteAddr, conv) {
  const id = getId(remotePort, remoteAddr)

  if (!pool.kcpConv[id]) {
    pool.kcpConv[id] = {
      nextConv: 0,
    }
  }

  const socketConv = pool.kcpConv[id]

  delete socketConv[conv]
}

export function createPool() {
  // TODO: Encryption
  const pool = {
    connections: {},
    connCounts: 0,
    kcpConv: {},
  }

  pool.send = send.bind(null, pool)
  pool.getSocket = getSocket.bind(null, pool)
  pool.listen = listen.bind(null, pool)
  pool.listenRemote = listenRemote.bind(null, pool)
  pool.clear = clear.bind(null, pool)
  pool.newConv = newConv.bind(null, pool)
  pool.deleteConv = deleteConv.bind(null, pool)
  pool.removeListener = removeListener.bind(null, pool)

  return pool
}

export const defaultPool = createPool()
