// all sync functions
import { getCurrent } from './kcp'

class Updater {
  constructor() {
    this.heap = []

    this.isUpdating = false
    this.updateStatus = this.updateStatus.bind(this)
    this.updateTask = this.updateTask.bind(this)
  }

  addSocket(socket) {
    this.heap.push(socket)

    this.updateStatus()
  }

  updateTask() {
    const { heap } = this

    const { length } = heap
    const nextHeap = []

    for (let i = 0; i < length; i += 1) {
      const socket = heap[i]

      if (!socket.closed) {
        const current = getCurrent()
        socket.update(current)
        nextHeap.push(socket)
      }
    }

    this.heap = nextHeap

    this.isUpdating = false
    this.updateStatus()
  }

  updateStatus() {
    if (this.isUpdating || this.heap.length === 0) {
      return
    }

    this.isUpdating = true

    // TODO:
    setTimeout(() => {
      process.nextTick(this.updateTask)
    }, 10)
  }
}

export const defaultUpdater = new Updater()
