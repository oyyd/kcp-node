/**
 * Pool manage udp connections for:
 * 1. Sockets with a same destination don't bind extral local ports.
 * 2. Support crc, fec, data encoding/decoding.
 */
import dgram from 'dgram'
import { warn } from './log'

// TODO: how to delete unused udp sockets

const WARN_LIMIT = 3000

// @private
export function encodeBuf() {

}

// @private
export function decodeBuf() {

}

function getId(port, address, local) {
  return `${local ? 'l' : 'r'} ${port}:${address}`
}

function getOrCreateSocket(pool, id) {
  const { connections } = pool
  let socket
  if (connections[id]) {
    socket = connections[id]
  } else {
    socket = dgram.createSocket('udp4')
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
  socket.on('message', onMessage)

  return socket
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

export function send(pool, data, remotePort, remoteAddr, done) {
  const id = getId(remotePort, remoteAddr, false)
  const socket = getOrCreateSocket(pool, id)

  // TODO: encode
  socket.send(data, remotePort, remoteAddr, done)

  return socket
}

export function close(pool) {
  const { connections } = pool

  Object.keys(connections).forEach((id) => {
    const socket = connections[id]

    socket.close()
  })
}

export function createPool() {
  // TODO: Encryption
  const pool = {
    connections: {},
    connCounts: 0,
  }

  pool.send = send.bind(null, pool)
  pool.listen = listen.bind(null, pool)
  pool.close = close.bind(null, pool)

  return pool
}
