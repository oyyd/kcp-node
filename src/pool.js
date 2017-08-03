/**
 * Pool manage udp connections for:
 * 1. Sockets with a same destination don't bind extral local ports.
 * 2. Support crc, fec, data encoding/decoding.
 * 3. Manage kcp conv.
 */
import dgram from 'dgram'
import { warn } from './log'
import { getConv, IKCP_MTU_DEF } from './kcp'
import { encrypt, decrypt, ENCRYPTED_EXPAND_SIZE } from './encrypt'

const MAX_INT32 = 2147483647
const WARN_LIMIT = 3000
const WARN_LISTENER_LIMIT = 3000

function useEncryption(pool) {
  const { algorithm, password } = pool
  return algorithm && password
}

// @private
export function decodeBuf(options, next, d, rinfo) {
  const { algorithm, password } = options

  if (!useEncryption(options)) {
    return next(d, rinfo)
  }

  return next(decrypt(algorithm, password, d), rinfo)
}

// @private
export function encodeBuf(options, next, d) {
  const { algorithm, password } = options

  if (!useEncryption(options)) {
    return next(d)
  }

  return next(encrypt(algorithm, password, d))
}

// @private
export function getId(port, address, local) {
  return `${local ? 'l' : 'r'} ${port}:${address}`
}

// TODO: allow modifying buffer from outside
export function createKCPSocket(pool) {
  const socket = dgram.createSocket('udp4')

  // init
  socket.setMaxListeners(WARN_LISTENER_LIMIT)

  socket.on('message', decodeBuf.bind(null, pool, (d, rinfo) => {
    const conv = getConv(d)

    // TODO: do not need to decode if there is no listener
    socket.emit('kcp_msg', {
      conv,
      data: d,
    }, rinfo)
  }))

  return socket
}

function getOrCreateSocketInfo(pool, id) {
  const { connections } = pool
  let socketInfo
  if (connections[id]) {
    socketInfo = connections[id]
  } else {
    const socket = createKCPSocket(pool)
    socketInfo = {
      socket,
      usingCount: 0,
    }
    connections[id] = socketInfo
    pool.udpCount += 1

    if (pool.udpCount > WARN_LIMIT) {
      warn(`Too many udp sockets: ${pool.udpCount}`)
    }
  }
  return socketInfo
}

export function listen(pool, localPort, onMessage, onListen) {
  const localAddr = '127.0.0.1'
  const id = getId(localPort, localAddr, true)

  const socketInfo = getOrCreateSocketInfo(pool, id)
  const socket = socketInfo.socket

  socket.bind(localPort, onListen)

  // TODO: error handleing
  // TODO: decode
  socket.on('kcp_msg', onMessage)

  socketInfo.usingCount += 1
  return socket
}

export function listenRemote(pool, remotePort, remoteAddr, onMessage) {
  const id = getId(remotePort, remoteAddr, false)
  const socketInfo = getOrCreateSocketInfo(pool, id)
  const socket = socketInfo.socket

  socket.on('kcp_msg', onMessage)

  socketInfo.usingCount += 1

  return socketInfo
}

export function removeSocket(pool, id) {
  const socketInfo = pool.connections[id]

  if (!socketInfo) {
    return false
  }

  const { socket } = socketInfo

  if (socket) {
    socket.close()
    delete pool.connections[id]
    pool.udpCount -= 1
  }

  return true
}

export function removeListener(pool, remotePort, remoteAddr, onMessage) {
  const id = getId(remotePort, remoteAddr, false)
  const socketInfo = getOrCreateSocketInfo(pool, id)
  const socket = socketInfo.socket

  socket.removeListener('kcp_msg', onMessage)
  socketInfo.usingCount -= 1

  if (socketInfo.usingCount === 0) {
    removeSocket(pool, id)
  }
}

export function getSocket(pool, remotePort, remoteAddr) {
  const id = getId(remotePort, remoteAddr, false)
  const socket = getOrCreateSocketInfo(pool, id).socket

  return socket
}

// TODO: Make sure sockets created for sending are closed correctly.
export function send(pool, data, remotePort, remoteAddr, done) {
  const socket = getSocket(pool, remotePort, remoteAddr)

  // TODO: encode
  socket.send(data, remotePort, remoteAddr, done)

  return socket
}

export function clear(pool) {
  const { connections } = pool

  Object.keys(connections).forEach((id) => removeSocket(pool, id))
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

export function createPool(options) {
  const pool = Object.assign({
    // default options
    algorithm: null,
    password: null,
  }, options, {
    connections: {},
    udpCount: 0,
    kcpConv: {},
  })

  pool.send = send.bind(null, pool)
  pool.getSocket = getSocket.bind(null, pool)
  pool.listen = listen.bind(null, pool)
  pool.listenRemote = listenRemote.bind(null, pool)
  pool.clear = clear.bind(null, pool)
  pool.newConv = newConv.bind(null, pool)
  pool.deleteConv = deleteConv.bind(null, pool)
  pool.removeListener = removeListener.bind(null, pool)

  pool.kcpMTUSize = IKCP_MTU_DEF - (useEncryption(pool) ? ENCRYPTED_EXPAND_SIZE : 0)

  return pool
}

export const defaultPool = createPool()
