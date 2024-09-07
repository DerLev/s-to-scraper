import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Code,
  Grid,
  Group,
  Progress,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core"
import { Link } from "react-router-dom"
import { HiOutlineEye, HiOutlineTrash } from "react-icons/hi2"
import { useCallback, useEffect, useState } from "react"
import socket from "../socket"
import apiBaseUrl from "../apiBaseUrl"

const Dashboard = () => {
  const [currentDownloads, setCurrentDownloads] = useState<
    {
      filename: string
      percentage: number
      transfered: number
      length: number
      remaining: number
      eta: number
      runtime: number
      speed: number
    }[]
  >([])
  const [lastCurrentDownloadsLength, setLastCurrentDownloadsLength] =
    useState(0)
  const [downloadsQueue, setDownloadsQueue] = useState<
    { filename: string; url: string; timestamp: string; status: string }[]
  >([])
  const [files, setFiles] = useState<
    { filename: string; timestamp: string; servable: boolean }[]
  >([])

  const fetchDownloads = useCallback(async () => {
    await fetch(apiBaseUrl() + "/current-downloads")
      .then((res) => res.json())
      .then((res) => setCurrentDownloads(res))
    setLastCurrentDownloadsLength(currentDownloads.length)
    await fetch(apiBaseUrl() + "/current-queue")
      .then((res) => res.json())
      .then((res) => setDownloadsQueue(res))
  }, [currentDownloads.length])

  const fetchFiles = async () => {
    await fetch(apiBaseUrl() + "/all-files")
      .then((res) => res.json())
      .then((res) => setFiles(res))
  }

  useEffect(() => {
    const onConnect = () => {
      console.log("socket connected")
    }

    const onFileDownload = (
      data: {
        filename: string
        percentage: number
        transfered: number
        length: number
        remaining: number
        eta: number
        runtime: number
        speed: number
      }[],
    ) => {
      setCurrentDownloads(data)
      setDownloadsQueue((previous) =>
        previous
          .map((item) => {
            if (
              data.findIndex(
                (download) => download.filename === item.filename,
              ) >= 0
            ) {
              return
            }
            return item
          })
          .filter((item) => item !== undefined) as { filename: string, timestamp: string, url: string, status: string }[],
      )
      if (data.length < lastCurrentDownloadsLength) fetchFiles()
      setLastCurrentDownloadsLength(data.length)
    }

    socket.on("connect", onConnect)
    socket.on("fileDownload", onFileDownload)

    fetchDownloads()
    fetchFiles()

    return () => {
      socket.off("connect", onConnect)
      socket.off("fileDownload", onFileDownload)
    }
  }, [fetchDownloads, lastCurrentDownloadsLength])

  const abortDownload = async (filename: string) => {
    await fetch(apiBaseUrl() + "/cancel-download", {
      method: "DELETE",
      body: JSON.stringify({ filename }),
      headers: [["Content-Type", "application/json"]],
    })
    setCurrentDownloads((array) =>
      array.filter((download) => download.filename !== filename),
    )
  }

  const deleteFile = async (filename: string) => {
    await fetch(apiBaseUrl() + "/delete-file", {
      method: "DELETE",
      body: JSON.stringify({ filename }),
      headers: [["Content-Type", "application/json"]],
    })

    await fetchFiles()
  }

  return (
    <Grid>
      <Grid.Col span={6}>
        <Stack>
          <Title>Running Downloads</Title>
          {!currentDownloads.length && (
            <Text ta="center" c="dark.3" fw={700} fs="italic">
              No running Downloads
            </Text>
          )}
          {(currentDownloads.length && (
            <Table withTableBorder withColumnBorders withRowBorders striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>File</Table.Th>
                  <Table.Th>Progress</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {currentDownloads.map((download, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Code>{download.filename}</Code>
                    </Table.Td>
                    <Table.Td>
                      <Group grow>
                        <Progress
                          value={download.percentage}
                          animated
                        ></Progress>
                        <Text size="sm">
                          {Math.floor(download.percentage)}% ·{" "}
                          {Math.floor(download.eta / 60)}:
                          {(download.eta % 60).toString().padStart(2, "0")}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="light"
                        onClick={() => abortDownload(download.filename)}
                      >
                        <HiOutlineTrash />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )) ||
            null}
          <Title>Queued Downloads</Title>
          {(!downloadsQueue.length && (
            <Text ta="center" c="dark.3" fw={700} fs="italic">
              No Downloads queued
            </Text>
          )) ||
            null}
          {(downloadsQueue.length && (
            <Table withTableBorder withRowBorders striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>File</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {downloadsQueue.map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Code>{item.filename}</Code>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )) ||
            null}
          <Button fullWidth component={Link} to="/add">
            Add new file(s)
          </Button>
        </Stack>
      </Grid.Col>
      <Grid.Col span={6}>
        <Stack>
          <Title>Files downloaded</Title>
          {(!files.length && (
            <Text ta="center" c="dark.3" fw={700} fs="italic">
              No Files in Downloads directory
            </Text>
          )) ||
            null}
          {(files.length && (
            <Table withTableBorder withColumnBorders withRowBorders striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>File</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {files.map((file, index) => {
                  if (
                    currentDownloads.findIndex(
                      (download) => download.filename === file.filename,
                    ) >= 0
                  )
                    return
                  return (
                    <Table.Tr key={index}>
                      <Table.Td>
                        {file.servable === false ? (
                          <>
                            <Anchor>{file.filename}</Anchor>
                            <Badge size="sm" color="yellow">
                              Incomplete
                            </Badge>
                          </>
                        ) : (
                          <Anchor href={"/downloads/" + file.filename}>
                            {file.filename}
                          </Anchor>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <ActionIcon
                            variant="light"
                            component="a"
                            href={
                              file.servable
                                ? "/downloads/" + file.filename + "?dl=0"
                                : ""
                            }
                            disabled={!file.servable}
                          >
                            <HiOutlineEye />
                          </ActionIcon>
                          <ActionIcon
                            color="red"
                            variant="light"
                            onClick={() => deleteFile(file.filename)}
                          >
                            <HiOutlineTrash></HiOutlineTrash>
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          )) ||
            null}
        </Stack>
      </Grid.Col>
    </Grid>
  )
}

export default Dashboard
