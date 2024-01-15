import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs"
import { writeFile } from "fs/promises"
import { log } from "./log.js"
import { resolve } from "path"

type Downloads = {
  filename: string
  percentage: number
  transfered: number
  length: number
  remaining: number
  eta: number
  runtime: number
  speed: number
}

type Queue = {
  filename: string
  url: string
  timestamp: string
  status: "queued" | "downloading" | "finished" | "cancelled"
}

export default class DownloadsQueue {
  downloads: Downloads[] = []
  queue: Queue[] = []
  allowedDownloads: number = 5

  /* Run initialization */
  constructor() {
    /* Check if the queue.json file exists */
    const queueFile = resolve("./downloads", "queue.json")
    const exists = existsSync(queueFile)
    if (!exists) {
      /* Start with an empty queue if queue.json does not exist */
      const newQueueData: Queue[] = []
      this.queue = newQueueData
      /* Create queue.json */
      writeFileSync(
        queueFile,
        new Uint8Array(Buffer.from(JSON.stringify(newQueueData))),
        { encoding: "utf-8" },
      )
    } else {
      /* Read queue from queue.json */
      const data = JSON.parse(
        readFileSync(queueFile, { encoding: "utf-8" }).toString(),
      ) as Queue[]
      /* Clear all finished files from queue (to save space) */
      const cleanedData = data.filter((item) => item.status !== "finished")
      this.queue = cleanedData

      /* Fix interruped downloads */
      const interruped = this.queue.filter(
        (item) => item.status === "downloading",
      )
      /* Delete interrupted downloads... */
      interruped.map((item) => {
        const dest = resolve("./downloads", item.filename)
        const exists = existsSync(dest)
        if (exists) unlinkSync(dest)
      })
      /* ...and start them again */
      this.queue = this.queue.map((item) => {
        if (item.status === "downloading") {
          log(`Requeued interruped download of ${item.filename}`)
          return { ...item, status: "queued" }
        }
        return item
      })
    }
  }

  /**
   * Update the queue.json file
   */
  async #updateQueueFile() {
    /* Write the current queue to queue.json */
    const queueFile = resolve("./downloads", "queue.json")
    await writeFile(
      queueFile,
      new Uint8Array(Buffer.from(JSON.stringify(this.queue))),
    )
  }

  /**
   * Add a download to the queue
   * @param filename Name of the file being saved
   * @param url The URL for the direct download
   */
  async addToQueue(filename: string, url: string) {
    /* Create a timestamp */
    const timestamp = new Date().toISOString()
    /* Check if the filename is already in the queue */
    const alreadyInQueue = this.queue.find((item) => item.filename === filename)
    if (alreadyInQueue) {
      /* Replace the file in the queue */
      this.queue = this.queue.map((item) => {
        if (item.filename === filename) {
          return { filename, url, timestamp, status: "queued" }
        }
        return item
      })
    } else {
      /* Add the new download the the queue */
      this.queue.push({ filename, url, timestamp, status: "queued" })
    }
    /* Update queue.json */
    await this.#updateQueueFile()

    /* Add log entry */
    log(
      `${filename} added to download queue. Queue is now ${
        this.enqueuedDownloads.length
      } download${this.enqueuedDownloads.length !== 1 ? "s" : ""} long`,
    )
  }

  /**
   * Update a file in downloads array
   */
  set updateDownload(input: Downloads) {
    /* Check if file is in array */
    if (this.downloads.find((item) => item.filename === input.filename)) {
      /* Replace download in array */
      this.downloads = this.downloads.map((item) => {
        if (item.filename === input.filename) {
          return input
        }
        return item
      })
    } else {
      /* Add file to array */
      this.downloads.push(input)
    }
  }

  /**
   * Remove download from downloads array and mark as done in queue
   * @param filename Filename of download
   * @param reason Reason for removal
   */
  async removeFromDownloads(
    filename: string,
    reason: "finished" | "cancelled",
  ) {
    /* Remove from downloads array */
    this.downloads = this.downloads.filter((item) => item.filename !== filename)
    /* Update in queue with reason */
    this.queue = this.queue.map((item) => {
      if (item.filename === filename) {
        return { ...item, status: reason }
      }
      return item
    })
    /* Update queue.json */
    await this.#updateQueueFile()

    /* Add log entry */
    log(
      `Download of ${filename} ${
        reason === "finished" ? "has finished" : "got cancelled"
      }`,
    )
  }

  /**
   * Get a specific file from the downloads queue
   * @param filname Filename of file to get from queue
   * @returns File in queue
   */
  getFileFromQueue(filname: string) {
    return this.queue.find((item) => item.filename === filname)
  }

  /**
   * Update a file in downloads queue
   * @param input New data
   */
  async updateQueue(input: Queue) {
    /* Update in queue */
    this.queue = this.queue.map((item) => {
      if (item.filename === input.filename) {
        return input
      }
      return item
    })
    /* Update queue.json */
    await this.#updateQueueFile()
  }

  /**
   * Is is allowed to start a new download instance
   */
  get startNewInstance() {
    return this.downloads.length < this.allowedDownloads
  }

  /**
   * How many instances are allowed to be started
   */
  get allowedInstances() {
    return Math.max(this.allowedDownloads - this.downloads.length, 0)
  }

  /**
   * All pending downloads in the queue
   */
  get enqueuedDownloads() {
    return this.queue
      .filter((item) => item.status === "queued")
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }
}
