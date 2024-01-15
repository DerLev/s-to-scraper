// import puppeteer from "puppeteer"
// import { resolve } from "path"
// import { createWriteStream } from "fs"
// import { finished } from "stream/promises"
// import { Readable } from "stream"
// ;(async () => {
//   const browser = await puppeteer.launch({
//     headless: "new",
//     executablePath: "/usr/bin/google-chrome",
//   })
//   const page = await browser.newPage()

//   await page.setViewport({ width: 1080, height: 1024 })

//   const scrapeUrl = "https://streamtape.com/e/g94VDJ0PvefqRmZ"
//   // const scrapeId = scrapeUrl.match(/[\w\d]{15}/)[0]

//   await page.goto(scrapeUrl)

//   const linkElement = await page.$("span#botlink")
//   if (!linkElement) return
//   const botlink = await (
//     await linkElement.getProperty("textContent")
//   ).jsonValue()
//   const video = "https:" + botlink + "&stream=1"

//   const stream = await fetch(video)
//   const fileName = (() => {
//     const arr = stream.url.split("/")
//     return arr[arr.length - 1].split("?")[0]
//   })()

//   if (!stream.body) return

//   const dest = resolve("./downloads", fileName)
//   const writeStream = createWriteStream(dest, { flags: "wx" })
//   await finished(Readable.fromWeb(stream.body).pipe(writeStream))

//   await browser.close()
// })()
