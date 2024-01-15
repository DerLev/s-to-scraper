import Joi from "joi"

interface DownloadURL {
  url: string
}

interface FetchSeries extends DownloadURL {
  includeOthers?: boolean
}

interface Filename {
  filename: string
}

export const fetchDownloadUrl = Joi.object<DownloadURL>({
  url: Joi.string().uri().required(),
})

export const addDownload = Joi.object<DownloadURL>({
  url: Joi.string().uri().required(),
})

export const cancelDownload = Joi.object<Filename>({
  filename: Joi.string().required(),
})

export const deleteFile = Joi.object<Filename>({
  filename: Joi.string().required(),
})

export const fetchSeries = Joi.object<FetchSeries>({
  url: Joi.string().uri().required(),
  includeOthers: Joi.boolean(),
})

export const fetchSeason = Joi.object<DownloadURL>({
  url: Joi.string().uri().required(),
})

export const fetchEpisode = Joi.object<DownloadURL>({
  url: Joi.string().uri().required(),
})
