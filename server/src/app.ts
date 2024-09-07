import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import cors from "cors"
import puppeteer from "puppeteer"
import {
  fetchEpisode,
  fetchSeason,
  fetchDownloadUrl,
  fetchSeries,
  addDownload,
  cancelDownload,
  deleteFile,
} from "./validators.js"
import { sToEpisode, sToSeason, sToSeries, streamtape } from "./scrapers.js"
import downloader, {
  getFileFromJson,
  getFileJson,
  prepareFolder,
  removeFileFromJson,
} from "./downloader.js"
import { resolve } from "path"
import { existsSync } from "fs"
import DownloadsQueue from "./downloadsQueue.js"
import { unlink } from "fs/promises"
import { log, startMsg } from "./log.js"

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: "/usr/bin/google-chrome",
})

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
  },
})

/* Prepare downloads folder */
await prepareFolder()
const dlq = new DownloadsQueue()

app.use(cors())
app.disable("x-powered-by")
app.use(express.json())

app.use(express.static("client"))

/**
 * Display a notice for dev mode or client failure
 * NOTE: since this is defined after the static files middleware
 *       it will only get rendered when no index.html is present
 */
app.get("/", (req, res) => {
  const subtitle =
    process.env.NODE_ENV === "production"
      ? "Something didn't work with the React client"
      : "You are in development mode! Use an API testing tool to interact with the API"
  res.set("Content-Type", "text/plain").send(`Hello World!\n${subtitle}`)
})

/* Endpoint for downloading/viewing files */
app.get("/downloads/:filename", async (req, res) => {
  /* Disallow system files */
  const disallowedFilenames = [".gitkeep", "files.json", "queue.json"]
  if (disallowedFilenames.find((item) => item === req.params.filename))
    return res.status(403).json({ code: 403, message: "This is a system file" })

  /* Get file from downloads directory */
  const file = resolve("./downloads", req.params.filename)
  /* Throw error if file does not exist */
  const exists = existsSync(file)
  if (!exists)
    return res
      .status(404)
      .json({ code: 404, message: "This file does not exist" })
  /* Throw error if file is not "viewable" (aka being downloaded) */
  const filestore = await getFileFromJson(req.params.filename)
  if (filestore?.servable === false)
    return res.status(423).json({
      code: 423,
      message: "This file is locked. It's possibly currently being downloaded",
    })

  /* Query param dl=0 allows viewing of file */
  const contentDisposition =
    Number(req.query.dl) === 0
      ? "inline"
      : `attachment; filename="${req.params.filename}"`

  /* Send file to user */
  res.setHeader("Content-Disposition", contentDisposition).sendFile(file)
})

/* Api router for all api routes (/api) */
const api = express.Router()

/* Get all available files */
api.get("/all-files", async (req, res) => {
  const filesJson = await getFileJson()
  res.status(200).json(filesJson)
})

/* Fetch a direct download URL */
api.post("/fetch-download-url", async (req, res) => {
  /* Validate request body */
  const { value: body, error } = fetchDownloadUrl.validate(req.body)
  if (error)
    return res
      .status(400)
      .json({ code: 400, message: error.details[0].message })

  /* Only allow URLs from supported providers (Streamtape) */
  if (!body.url.match(/(https:\/\/streamtape.com\/e\/)[\w\d]{14,15}/))
    res.status(400).json({ code: 400, message: "URL not valid" })

  /* Get the direct download URL with puppeteer */
  const downloadUrl = await streamtape(browser, body.url)

  res.status(200).json(downloadUrl)
})

/* Add a download to the downloads queue */
api.post("/add-download", async (req, res) => {
  /* Validate request body */
  const { value: body, error } = addDownload.validate(req.body)
  if (error)
    return res
      .status(400)
      .json({ code: 400, message: error.details[0].message })

  const url = body.url

  /* Only allow URLs from supported providers (Streamtape) */
  if (!url.match(/(https:\/\/streamtape.com\/e\/)[\w\d]{14,15}/))
    return res.status(400).json({ code: 400, message: "URL not valid" })

  /* Get the direct download URL with puppeteer */
  const downloadUrl = await streamtape(browser, url)
  if (!downloadUrl)
    return res
      .status(400)
      .json({ code: 400, message: "Could not find download url" })

  const finalFilename = body.filename || downloadUrl.filename

  /* Check for disallowed filenames */
  const disallowedFilenames = [".gitkeep", "files.json", "queue.json"]
  if (disallowedFilenames.find((name) => name === finalFilename))
    return res.status(403).json({
      code: 403,
      message: "This filename is reserved for system usage",
    })

  /* Check if file already exists */
  const dest = resolve("./downloads", finalFilename)
  const exists = existsSync(dest)
  if (exists)
    return res
      .status(403)
      .json({ code: 403, message: "The file already exists" })

  /**
   * Add download to the queue
   * NOTE: A download worker will be started automatically
   */
  dlq.addToQueue(finalFilename, downloadUrl.url)

  // downloader(io, dlq, downloadUrl.url, downloadUrl.filename)

  res.status(202).json({ code: 202, message: "Download queued!" })
  // res
  //   .status(201)
  //   .setHeader("Location", `/downloads/${downloadUrl.filename}`)
  //   .json({ code: 201, message: "Download started!" })
})

/* Get all current downloads */
api.get("/current-downloads", (req, res) => {
  res.status(200).json(dlq.downloads)
})

/* Get complete queue */
api.get("/current-queue", (req, res) => {
  res.status(200).json(dlq.enqueuedDownloads)
})

/* Cancel a download */
api.delete("/cancel-download", async (req, res) => {
  /* Validate request body */
  const { value: body, error } = cancelDownload.validate(req.body)
  if (error)
    return res
      .status(400)
      .json({ code: 400, message: error.details[0].message })

  /* Get download from downloads queue */
  const inQueue = dlq.getFileFromQueue(body.filename)
  if (!inQueue)
    return res.status(400).json({ code: 400, message: "File is not in queue" })
  if (inQueue.status === "finished" || inQueue.status === "cancelled")
    return res
      .status(403)
      .json({ code: 403, message: "File already finished/cancelled" })

  /**
   * Set status to cancelled
   * NOTE: The download worker will cancel the download
   */
  await dlq.updateQueue({ ...inQueue, status: "cancelled" })
  res.status(200).json({ code: 200, message: "Download cancelled!" })
})

/* Delete a file from the downloads directory */
api.delete("/delete-file", async (req, res) => {
  /* Validate request body */
  const { value: body, error } = deleteFile.validate(req.body)
  if (error)
    return res
      .status(400)
      .json({ code: 400, message: error.details[0].message })

  if (dlq.downloads.find((item) => item.filename === body.filename))
    return res.status(403).json({
      code: 403,
      message:
        "This file is currently being downloaded. Cancel the download first!",
    })

  /* Delete file and remove entry from files.json */
  const dest = resolve("./downloads", body.filename)
  await unlink(dest)
  await removeFileFromJson(body.filename)

  log(`${body.filename} was deleted`)

  res.status(200).json({ code: 200, message: "File deleted" })
})

/* Fetch seasons for a series on s.to/aniworld.to */
api.post("/fetch-series", async (req, res) => {
  /* Validate request body */
  const { value: body, error } = fetchSeries.validate(req.body)
  if (error)
    return res
      .status(400)
      .json({ code: 400, message: error.details[0].message })

  const url = body.url
  /* Only allow URLs from s.to & aniworld.to */
  if (
    !url.match(/^(https:\/\/s\.to\/serie\/stream\/)([a-z0-9-]+)(\/)?$/) &&
    !url.match(/^(https:\/\/aniworld\.to\/anime\/stream\/)([a-z0-9-]+)(\/)?$/)
  )
    return res.status(400).json({ code: 400, message: "URL not supported" })

  try {
    /* Get seasons with puppeteer */
    const seasons = await sToSeries(browser, url, body.includeOthers)
    res.status(200).json(seasons)
  } catch (err) {
    res.status(500).json({ code: 500, message: err })
  }
})

/* Fetch episodes from s.to/aniworld.to */
api.post("/fetch-season", async (req, res) => {
  /* Validate request body */
  const { value: body, error } = fetchSeason.validate(req.body)
  if (error)
    return res
      .status(400)
      .json({ code: 400, message: error.details[0].message })

  const url = body.url
  /* Only allow URLs from s.to & aniworld.to */
  if (
    !url.match(
      /^(https:\/\/s\.to\/serie\/stream\/)([a-z0-9-]+)\/staffel-\d{1,}(\/)?$/,
    ) &&
    !url.match(
      /^(https:\/\/aniworld\.to\/anime\/stream\/)([a-z0-9-]+)\/staffel-\d{1,}(\/)?$/,
    )
  )
    return res.status(400).json({ code: 400, message: "URL not supported" })

  /* Get episodes with puppeteer */
  const seasonData = await sToSeason(browser, url)

  res.status(200).json(seasonData)
})

/* Fetch download servers for s.to/aniworld.to episode */
api.post("/fetch-episode", async (req, res) => {
  /* Validate request body */
  const { value: body, error } = fetchEpisode.validate(req.body)
  if (error)
    return res
      .status(400)
      .json({ code: 400, message: error.details[0].message })

  const url = body.url
  /* Only allow urls from s.to & aniworld.to */
  if (
    !url.match(
      /^(https:\/\/s\.to\/serie\/stream\/)([a-z0-9-]+)\/staffel-\d{1,}\/episode-\d{1,}(\/)?$/,
    ) &&
    !url.match(
      /^(https:\/\/aniworld\.to\/anime\/stream\/)([a-z0-9-]+)\/staffel-\d{1,}\/episode-\d{1,}(\/)?$/,
    )
  )
    return res.status(400).json({ code: 400, message: "URL not supported" })

  /* Get download URLs with puppeteer */
  const { streams, episodeNumber, seasonNumber } = await sToEpisode(
    browser,
    url,
  )

  /* List of providers supported by this app */
  const usableProviders = ["Streamtape"]

  /* Resolve redirects for supported providers */
  const fetchPromises = streams.map((stream) => {
    if (usableProviders.find((prov) => prov === stream?.prov)) {
      return fetch("https://" + url.split("/")[2] + stream?.url)
    }
  })

  const streamUrlRes = await Promise.all(fetchPromises)

  /* Merge resolved redirects into res array */
  const finalStreamsArr = streams.map((stream, index) => {
    if (streamUrlRes[index] !== undefined)
      return {
        provider: stream?.prov,
        url: streamUrlRes[index]?.url,
        supported: true,
      }
    return {
      provider: stream?.prov,
      url: "https://" + url.split("/")[2] + stream?.url,
      supported: false,
    }
  })

  res
    .status(200)
    .json({ seasonNumber, episodeNumber, streams: finalStreamsArr })
})

/* Apply api router (/api) */
app.use("/api", api)

/* Handle 404 */
app.use((req, res) => {
  res.status(404)

  // respond with html page
  // if (req.accepts("html")) {
  //   return res.render("404", { url: req.url })
  // }

  // respond with json
  if (req.accepts("json")) {
    return res.json({ code: 404, message: "Not found" })
  }

  // default to plain-text. send()
  return res.type("txt").send("Not found")
})

/* "cron"-job for downloads queue */
const downloadStarter = () => {
  if (dlq.startNewInstance && dlq.enqueuedDownloads.length) {
    const newDownload = dlq.enqueuedDownloads[0]
    downloader(io, dlq, newDownload.url, newDownload.filename)
    log(`Download of ${newDownload.filename} started`)
  }
}
setInterval(() => downloadStarter(), 5000)
// const downloadQueueInterval = setInterval(() => downloadStarter(), 5000)

// const shutdown = () => {
//   /* eslint-disable-next-line no-console */
//   console.log("Shutting down...")
//   // clearInterval(downloadQueueInterval)
//   // dlq.downloads.map((item) => {
//   //   const fromQueue = dlq.getFileFromQueue(item.filename)
//   //   if (!fromQueue) return
//   //   dlq.updateQueue({ ...fromQueue, status: "cancelled" })
//   // })
//   // while (dlq.downloads.length) {
//   //   /* Wait for downloads to be cancelled */
//   // }
//   process.exit(0)
// }

// process.on("SIGINT", shutdown)
// process.on("SIGTERM", shutdown)

/* Get hostname & port from env + start webserver */
const hostname = process.env.HOSTNAME || "localhost"
const port = Number(process.env.PORT) || 3000
server.listen({ port, hostname }, () => {
  startMsg(hostname, port)
})
