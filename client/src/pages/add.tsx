import {
  ActionIcon,
  Box,
  Button,
  Flex,
  Group,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core"
import {
  HiOutlineCheck,
  HiOutlineMagnifyingGlass,
  HiOutlinePlus,
  HiOutlineXMark,
} from "react-icons/hi2"
import { useForm } from "@mantine/form"
import { Link } from "react-router-dom"
import { useState } from "react"
import apiBaseUrl from "../apiBaseUrl"

const Add = () => {
  const [formDisabled, setFormDisabled] = useState(false)

  const form = useForm({
    initialValues: {
      url: "",
    },

    validate: {
      url: (value) =>
        /^(https:\/\/(s|aniworld)\.to\/(serie|anime)\/stream\/)([a-z0-9-]+)(\/?|\/staffel-\d{1,}(\/?|\/episode-\d{1,}(\/?)))$/.test(
          value,
        )
          ? null
          : "Invalid URL",
    },
  })

  const [seasonsArray, setSeasonsArray] = useState<string[]>([])
  const [episodesObject, setEpisodesObject] = useState<{
    seasonNumber: string
    episodes: {
      episodeNumber: string
      url: string
      languages: string[]
      providers: string[]
    }[]
  } | null>(null)
  const [providersObject, setProvidersObject] = useState<{
    seasonNumber: string
    episodeNumber: string
    streams: { provider: string; url: string; supported: boolean }[]
  } | null>(null)

  const searchUrl = async (url: string) => {
    setFormDisabled(true)

    /* Test URL to decide which endpoint to make a request to */
    let endpoint: "series" | "season" | "episode" = "series"

    if (
      /^(https:\/\/(s|aniworld)\.to\/(serie|anime)\/stream\/)([a-z0-9-]+)(\/?)$/.test(
        url,
      )
    ) {
      endpoint = "series"
    } else if (
      /^(https:\/\/(s|aniworld)\.to\/(serie|anime)\/stream\/)([a-z0-9-]+)(\/?|\/staffel-\d{1,}(\/?))$/.test(
        url,
      )
    ) {
      endpoint = "season"
    } else if (
      /^(https:\/\/(s|aniworld)\.to\/(serie|anime)\/stream\/)([a-z0-9-]+)(\/?|\/staffel-\d{1,}(\/?|\/episode-\d{1,}(\/?)))$/.test(
        url,
      )
    ) {
      endpoint = "episode"
    } else {
      throw new Error("Could not identify an endpoint matching url")
    }

    setSeasonsArray([])
    setEpisodesObject(null)
    setProvidersObject(null)

    switch (endpoint) {
      case "series":
        await fetch(apiBaseUrl() + "/fetch-series", {
          method: "POST",
          body: JSON.stringify({ url }),
          headers: [["Content-Type", "application/json"]],
        })
          .then((res) => res.json())
          .then((res) => setSeasonsArray(res))
        break
      case "season":
        await fetch(apiBaseUrl() + "/fetch-season", {
          method: "POST",
          body: JSON.stringify({ url }),
          headers: [["Content-Type", "application/json"]],
        })
          .then((res) => res.json())
          .then((res) => setEpisodesObject(res))
        break
      case "episode":
        await fetch(apiBaseUrl() + "/fetch-episode", {
          method: "POST",
          body: JSON.stringify({ url }),
          headers: [["Content-Type", "application/json"]],
        })
          .then((res) => res.json())
          .then((res) => setProvidersObject(res))
        break
      default:
        break
    }

    setFormDisabled(false)
  }

  const [seasonsLoading, setSeasonsLoading] = useState(false)
  const [episodesLoading, setEpisodesLoading] = useState(false)
  const [providersLoading, setProvidersLoading] = useState(false)

  const selectSeason = async (url: string) => {
    setSeasonsLoading(true)
    await fetch(apiBaseUrl() + "/fetch-season", {
      method: "POST",
      body: JSON.stringify({ url }),
      headers: [["Content-Type", "application/json"]],
    })
      .then((res) => res.json())
      .then((res) => setEpisodesObject(res))
    setProvidersObject(null)
    setSeasonsLoading(false)
  }

  const selectEpisode = async (url: string) => {
    setEpisodesLoading(true)
    await fetch(apiBaseUrl() + "/fetch-episode", {
      method: "POST",
      body: JSON.stringify({ url }),
      headers: [["Content-Type", "application/json"]],
    })
      .then((res) => res.json())
      .then((res) => setProvidersObject(res))
    setEpisodesLoading(false)
  }

  const addDownload = async (url: string) => {
    setProvidersLoading(true)
    await fetch(apiBaseUrl() + "/add-download", {
      method: "POST",
      body: JSON.stringify({ url }),
      headers: [["Content-Type", "application/json"]],
    })
    setProvidersLoading(false)
  }

  return (
    <Flex justify="center">
      <Box maw={616} w="100%" pb="xl">
        <Group justify="space-between">
          <Title mb="sm">Add file(s) to download</Title>
          <ActionIcon
            variant="subtle"
            radius="xl"
            size="xl"
            color="white"
            component={Link}
            to="/dashboard"
          >
            <HiOutlineXMark />
          </ActionIcon>
        </Group>
        <form onSubmit={form.onSubmit((values) => searchUrl(values.url))}>
          <Stack>
            <TextInput
              label="Enter a URL"
              placeholder="https://s.to/serie/stream/rick-and-morty/"
              type="url"
              {...form.getInputProps("url")}
              disabled={formDisabled}
            />
            <Button
              leftSection={<HiOutlineMagnifyingGlass />}
              type="submit"
              loading={formDisabled}
            >
              Search
            </Button>
          </Stack>
        </form>
        {(seasonsArray.length && (
          <Skeleton visible={seasonsLoading}>
            <Stack mt="lg">
              <Title size="h2">Select a Season</Title>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Season</Table.Th>
                    <Table.Th>Select</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {seasonsArray.map((season, index) => (
                    <Table.Tr key={index}>
                      <Table.Td>
                        <Text>Season {index + 1}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          leftSection={<HiOutlineCheck />}
                          variant="subtle"
                          onClick={() => selectSeason(season)}
                        >
                          Select
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </Skeleton>
        )) ||
          null}
        {episodesObject !== null ? (
          <Skeleton visible={seasonsLoading || episodesLoading}>
            <Stack mt="lg">
              <Title size="h2">
                Select an Episode from Season {episodesObject.seasonNumber}
              </Title>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Episode</Table.Th>
                    <Table.Th>Select</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {episodesObject.episodes.map((episode, index) => (
                    <Table.Tr key={index}>
                      <Table.Td>
                        <Text>Episode {episode.episodeNumber}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          leftSection={<HiOutlineCheck />}
                          variant="subtle"
                          onClick={() => selectEpisode(episode.url)}
                        >
                          Select
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </Skeleton>
        ) : null}
        {providersObject !== null ? (
          <Skeleton
            visible={seasonsLoading || episodesLoading || providersLoading}
          >
            <Stack mt="lg">
              <Title size="h2">
                Select a Provider for S
                {providersObject.seasonNumber.padStart(2, "0")}E
                {providersObject.episodeNumber.padStart(2, "0")}
              </Title>
              <Title size="h4">Supported Providers</Title>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Provider</Table.Th>
                    <Table.Th>Download</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {providersObject.streams
                    .filter((stream) => stream.supported === true)
                    .map((stream, index) => (
                      <Table.Tr key={index}>
                        <Table.Td>
                          <Text>{stream.provider}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Button
                            leftSection={<HiOutlinePlus />}
                            variant="subtle"
                            onClick={() => addDownload(stream.url)}
                          >
                            Add to Downloads
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                </Table.Tbody>
              </Table>
              <Title size="h4">Unsupported Providers</Title>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Provider</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {providersObject.streams
                    .filter((stream) => stream.supported === false)
                    .map((stream, index) => (
                      <Table.Tr key={index}>
                        <Table.Td>
                          <Text>{stream.provider}</Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </Skeleton>
        ) : null}
      </Box>
    </Flex>
  )
}

export default Add
