/**
 * Listen and reply to connections.
 */
import { EventEmitter } from 'events'
import { KCPSocket } from './socket'

// TODO: use hash as key
function getSocketId(conv, remotePort, remoteAddr) {
  return `${remotePort}:${remoteAddr} ${conv}`
}

export class Server extends EventEmitter {
  constructor(options) {
    super()

    const { pool, localPort } = options

    this.pool = pool
    this.onMessage = this.onMessage.bind(this)
    this.createSocket = this.createSocket.bind(this)
    this.kcpSockets = {}

    this.pool.listen(localPort, this.onMessage)
  }

  close() {

  }

  createSocket(id, options) {
    const socket = new KCPSocket(null, options)

    socket.on('close', () => {
      delete this.kcpSockets[id]
    })

    this.kcpSockets[id] = socket

    return socket
  }

  onMessage(msg, { address: remoteAddr, port: remotePort }) {
    const id = getSocketId(msg.conv, remotePort, remoteAddr)

    if (!this.kcpSockets[id]) {
      this.createSocket(id, {
        pool: this.pool,
        conv: msg.conv,
        remotePort,
        remoteAddr,
        user: 'server',
      })

      this.emit('connection', this.kcpSockets[id])
    }

    this.kcpSockets[id].onMessage(msg)
  }
}
