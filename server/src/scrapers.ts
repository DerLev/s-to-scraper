import type { Browser } from "puppeteer"

/**
 * Fetch the direct download URL and filename from streamtape.com
 * @param browser The puppeteer instance
 * @param url The URL to fetch a direct download from
 * @returns The filename and url for direct download
 */
export const streamtape = async (browser: Browser, url: string) => {
  /* Create a new page in puppeteer */
  const page = await browser.newPage()
  await page.setViewport({ width: 1080, height: 1024 })

  await page.goto(url)

  /* Get the download url from span#botlink */
  const linkElement = await page.$("span#botlink")
  if (!linkElement) return
  const botlink = await (
    await linkElement.getProperty("textContent")
  ).jsonValue()
  /* Add https and stram=1 */
  const video = "https:" + botlink + "&stream=1"

  /* Resolve the filename */
  const stream = await fetch(video)
  const fileName = (() => {
    const arr = stream.url.split("/")
    return arr[arr.length - 1].split("?")[0]
  })()

  await page.close()

  return { url: stream.url, filename: fileName }
}

/**
 * Fetch the direct download URL and filename from videzz.net
 * @param browser The puppeteer instance
 * @param url The URL to fetch a direct download from
 * @returns The filename and url for direct download
 */
export const vidoza = async (browser: Browser, url: string) => {
  /* Create a new page in puppeteer */
  const page = await browser.newPage()
  await page.setViewport({ width: 1080, height: 1024 })

  await page.goto(url)

  /* Get the download url from the video element */
  const videoElement = await page.$("video#player_html5_api")
  if (!videoElement) return
  const video = await (await videoElement.getProperty("src")).jsonValue()

  /* Resolve the filename */
  const stream = await fetch(video)
  const fileName = (() => {
    const arr = stream.url.split("/")
    return arr[arr.length - 1].split("?")[0]
  })()

  await page.close()

  return { url: stream.url, filename: fileName }
}

/**
 * Fetch all seasons from a series on s.to/aniworld.to
 * @param browser The pupeteer instance
 * @param url The URL to fetch seasons from
 * @param includeOthers Include specials in result
 * @returns Array of URLs of seasons
 */
export const sToSeries = async (
  browser: Browser,
  url: string,
  includeOthers?: boolean,
) => {
  /* Create a new page in pupeteer */
  const page = await browser.newPage()
  await page.setViewport({ width: 1080, height: 1024 })

  await page.goto(url)

  /* Because s.to returns an alert instead of a 404 we need to look for that */
  const getAlert = await page.$("div.messageAlert.danger")
  /* Error if 404-ish */
  if (getAlert) {
    await page.close()
    throw new Error("Page does not exist")
  }

  /* Get all seasons from DOM */
  const subPages = await page.evaluate(() => {
    /* Get the nav (seasons and episodes of 1st season) */
    const navs = Array.from(document.querySelectorAll("div#stream > ul"))
    /* Only look at seasons */
    const seasons = navs.map((nav) => {
      if (
        nav?.firstElementChild?.firstElementChild?.firstElementChild
          ?.innerHTML === "Staffeln:"
      )
        return nav
    })[0]
    if (!seasons) return
    /* Return URLs */
    return Array.from(seasons.children)
      .map((child) => {
        if (child?.firstElementChild?.tagName === "A") {
          const a = child.firstElementChild as HTMLAnchorElement
          return a.href
        }
      })
      .filter((item) => item !== undefined)
  })

  /* Only return season URLs if includeOthers === false */
  const seasons = subPages
    ?.map((page) => {
      const split = page?.split("/") || []
      if (
        split[split.length - 1].match(/(staffel-)\d{1,}/) ||
        includeOthers === true
      )
        return page
    })
    .filter((item) => item !== undefined) as string[] | undefined

  await page.close()

  return seasons
}

/**
 * Fetch all episodes from a s.to/aniworld.to URL
 * @param browser The puppeteer instance
 * @param url The URL to fetch episodes from
 * @returns Episode URLs
 */
export const sToSeason = async (browser: Browser, url: string) => {
  /* Create page in puppeteer */
  const page = await browser.newPage()
  await page.setViewport({ width: 1080, height: 1024 })

  await page.goto(url)

  /* Get the season number from DOM */
  const seasonNumber = await page.$eval(
    "meta[itemprop=seasonNumber]",
    (element) => element.content,
  )

  /* Get all episode rows from DOM */
  const episodeRows = await page.$$("table.seasonEpisodesList > tbody > tr")

  /* Get episode number, languages, providers, and URL */
  const episodePromises = episodeRows.map(async (element) => {
    const epNum = await element.$eval(
      "meta[itemprop=episodeNumber]",
      (el) => el.content,
    )
    const epLink = await element.$eval("a[itemprop=url]", (el) => el.href)
    const epProviders = await element.$$eval("i.icon", (elements) =>
      elements.map((el) => el.title),
    )
    const epLangs = await element.$$eval("img.flag", (elements) =>
      elements.map((el) => el.title),
    )

    return {
      episodeNumber: epNum,
      url: epLink,
      providers: epProviders,
      languages: epLangs,
    }
  })

  const episodes = await Promise.all(episodePromises)

  await page.close()

  return { seasonNumber, episodes }
}

/**
 * Fetch all provider URLs from an s.to/aniworld.to episode
 * @param browser The pupeteer instance
 * @param url The URL to get provider links from
 * @returns The provider URLs
 */
export const sToEpisode = async (browser: Browser, url: string) => {
  /* Create a page in puppeteer */
  const page = await browser.newPage()
  await page.setViewport({ width: 1080, height: 1024 })

  await page.goto(url)

  /* Get all visible redirects */
  const streams = (
    await page.$$eval("div.hosterSiteVideo > ul.row > li", (elements) =>
      elements.map((el) => {
        if (el.style.display !== "none")
          return {
            url: el.dataset.linkTarget,
            prov: el.innerText.split("\n")[0],
          }
      }),
    )
  ).filter((item) => item !== null)

  /* Get the episode and season number */
  const episodeNumber = await page.$eval(
    "meta[itemprop=episode]",
    (el) => el.content,
  )
  const seasonNumber = await page.$eval(
    "meta[itemprop=seasonNumber]",
    (el) => el.content,
  )

  await page.close()

  return { streams, episodeNumber, seasonNumber }
}
