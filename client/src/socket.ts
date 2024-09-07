import { io } from "socket.io-client"

const URL =
  import.meta.env.MODE === "development" ? "http://localhost:3000/" : undefined

/* eslint-disable @typescript-eslint/ban-ts-comment */
/* @ts-ignore */
const socket = io(URL)
/* eslint-enable */

export default socket
