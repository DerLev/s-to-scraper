import { resolve } from "path"
import { createWriteStream, existsSync, mkdirSync } from "fs"
import { finished } from "stream/promises"
import { Readable } from "stream"
import type { ReadableStream } from "stream/web"
import progress from "progress-stream"
import { readFile, writeFile } from "fs/promises"
import type { Server } from "socket.io"
import type DownloadsQueue from "./downloadsQueue.js"

type DataFile = {
  filename: string
  servable: boolean
  timestamp: string
}[]

/**
 * Get all files from files.json
 * @returns The data saved in files.json
 */
export const getFileJson = async () => {
  /* Check if files.json exists */
  const dataFile = resolve("./downloads", "files.json")
  const fileExists = existsSync(dataFile)
  if (!fileExists) throw new Error("Data file does not exist")

  /* Parse the data in files.json */
  const data = JSON.parse(
    (await readFile(dataFile, { encoding: "utf-8" })).toString(),
  ) as DataFile

  /* Return the files */
  return data
}

/**
 * Get a file from files.json
 * @param filename The filename of the downloaded file
 * @returns The data saved in files.json
 */
export const getFileFromJson = async (filename: string) => {
  /* Check if files.json exists */
  const dataFile = resolve("./downloads", "files.json")
  const fileExists = existsSync(dataFile)
  if (!fileExists) throw new Error("Data file does not exist")

  /* Parse the data in files.json */
  const data = JSON.parse(
    (await readFile(dataFile, { encoding: "utf-8" })).toString(),
  ) as DataFile

  /* Return the specified file */
  return data.find((item) => item.filename === filename)
}

/**
 * Add a file to files.json for serving
 * @param filename Filename to add
 * @param servable Is the file servable to users
 */
export const addFileToJson = async (filename: string, servable: boolean) => {
  /* Check if files.json exists */
  const dataFile = resolve("./downloads", "files.json")
  const fileExists = existsSync(dataFile)
  if (!fileExists) throw new Error("Data file does not exist")

  /* Parse the data in files.json */
  const data = JSON.parse(
    (await readFile(dataFile, { encoding: "utf-8" })).toString(),
  ) as DataFile

  const timestamp = new Date().toISOString()

  /* Append/overwrite file */
  const newData = (() => {
    if (data.find((item) => item.filename === filename)) {
      return data.map((item) => {
        if (item.filename === filename) return { ...item, servable, timestamp }
        return item
      })
    } else {
      return [...data, { filename, servable, timestamp }]
    }
  })()

  /* Save files.json */
  const newRawData = new Uint8Array(Buffer.from(JSON.stringify(newData)))
  await writeFile(dataFile, newRawData, { encoding: "utf-8" })
}

/**
 * Update a file in files.json
 * @param filename The filename of the file to update
 * @param servable Whether the file can be served to users
 */
export const updateFileInJson = async (filename: string, servable: boolean) => {
  /* Check if files.json exists */
  const dataFile = resolve("./downloads", "files.json")
  const fileExists = existsSync(dataFile)
  if (!fileExists) throw new Error("Data file does not exist")

  /* Parse the data inside files.json */
  const data = JSON.parse(
    (await readFile(dataFile, { encoding: "utf-8" })).toString(),
  ) as DataFile

  /* Update file in files.json */
  const newData = data.map((item) => {
    if (item.filename === filename) return { ...item, servable }
    return item
  })
  const newRawData = new Uint8Array(Buffer.from(JSON.stringify(newData)))
  await writeFile(dataFile, newRawData, { encoding: "utf-8" })
}

/**
 * Delete a file from files.json
 * @param filename Filename of file to delete from files.json
 */
export const removeFileFromJson = async (filename: string) => {
  /* Check if files.json exists */
  const dataFile = resolve("./downloads", "files.json")
  const fileExists = existsSync(dataFile)
  if (!fileExists) throw new Error("Data file does not exist")

  /* Parse the data inside files.json */
  const data = JSON.parse(
    (await readFile(dataFile, { encoding: "utf-8" })).toString(),
  ) as DataFile

  /* Remove the entry and save file */
  const newData = data.filter((item) => item.filename !== filename)
  const newRawData = new Uint8Array(Buffer.from(JSON.stringify(newData)))
  await writeFile(dataFile, newRawData, { encoding: "utf-8" })
}

/**
 * Download a file from an http server
 * @param io The socket.io-server instance
 * @param dlq The DownloadsQueue instance
 * @param url The direct download URL
 * @param filename The filename to save the downloaded content as
 */
const downloader = async (
  io: Server,
  dlq: DownloadsQueue,
  url: string,
  filename: string,
) => {
  /* Check for number of running downloads */
  if (!dlq.startNewInstance) return

  const site = await fetch(url)

  if (!site.body) return

  /* Update the status in DLQ to "downloading" */
  const inQueue = dlq.getFileFromQueue(filename)
  if (inQueue) {
    dlq.updateQueue({ ...inQueue, status: "downloading" })
  }

  const stream = Readable.fromWeb(site.body as ReadableStream<Uint8Array>)

  /* Track the progress of the download */
  const prg = progress(
    { time: 1000, length: Number(site.headers.get("Content-Length")) },
    async (progress) => {
      const newProgress = {
        filename,
        percentage: Number(progress.percentage.toFixed(2)),
        transfered: progress.transferred,
        length: progress.length,
        remaining: progress.remaining,
        eta: progress.eta,
        runtime: progress.runtime,
        speed: Number(progress.speed.toFixed(2)),
      }
      dlq.updateDownload = newProgress

      /* Check if the download got cancelled */
      const fromQueue = dlq.getFileFromQueue(filename)
      if (fromQueue?.status === "cancelled") {
        stream.destroy()
        await dlq.removeFromDownloads(filename, "cancelled")
      }

      io.emit("fileDownload", dlq.downloads)
    },
  )

  /* Check if the download got cancelled */
  // stream.on("data", async () => {
  //   const fromQueue = dlq.getFileFromQueue(filename)
  //   if (fromQueue?.status === "cancelled") {
  //     stream.destroy()
  //     await dlq.removeFromDownloads(filename, "cancelled")
  //   }
  // })

  /* Write the download to fs */
  const dest = resolve("./downloads", filename)
  await addFileToJson(filename, false)
  const writeStream = createWriteStream(dest, { flags: "wx" })
  await finished(stream.pipe(prg).pipe(writeStream))
  await updateFileInJson(filename, true)
  await dlq.removeFromDownloads(filename, "finished")
}

export default downloader

/**
 * Prepare the downloads folder (check if existsing)
 */
export const prepareFolder = async () => {
  /* Create downloads folder if not existing */
  const folder = resolve("./downloads")
  const folderExists = existsSync(folder)
  if (!folderExists) {
    mkdirSync(folder)
  }

  /* Create files.json if not existing */
  const dataFile = resolve("./downloads", "files.json")
  const fileExists = existsSync(dataFile)
  if (!fileExists) {
    const data = new Uint8Array(Buffer.from("[]"))
    await writeFile(dataFile, data, { encoding: "utf-8" })
  }
}
