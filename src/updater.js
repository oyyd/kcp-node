// TODO: make this module more generic for other features
import { changeFlushStatus } from './sess'

// TODO: Updater could be improved
class Updater {
  constructor() {
    this.heap = []
  }

  addSession(session) {
    this.heap.push(session)
  }

  updateTask() {
    const { heap } = this
    const { length } = heap

    for (let i = 0; i < length; i += 1) {
      const sess = heap[i]
    }
  }
}

export const defaultUpdater = new Updater()
