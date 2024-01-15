/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import chalk from "chalk"

/**
 * Print the "server started" message
 * @param hostname Hostname of the webserver
 * @param port Port of the webserver
 */
export const startMsg = (hostname: string, port: number) => {
  /* Clear the terminal with empty lines */
  const termHeight = Math.max(process.stdout.rows - 4, 0)
  const termClearer: string[] = []
  for (let i = 0; i < termHeight; i++) termClearer.push("\n")
  console.log(...termClearer)

  console.log(" ", chalk.dim(chalk.bold("Server running")))
  if (hostname !== "localhost") {
    console.log(
      "   ",
      chalk.dim("- External:"),
      chalk.green(chalk.underline(`http://${hostname}:${port}/`)),
    )
    console.log(
      "   ",
      chalk.dim("- Internal:"),
      chalk.green(chalk.underline(`http://localhost:${port}/`)),
    )
  } else {
    console.log(
      "   ",
      chalk.dim("- Internal:"),
      chalk.green(chalk.underline(`http://localhost:${port}/`)),
    )
  }
  console.log("")
}

const out = (front: string, ...content: any[]) => {
  const timestamp = new Date().toISOString()

  return [front, chalk.dim(timestamp), ...content]
}

/**
 * Log something to stdout
 * @param content things you want to log
 */
export const log = (...content: any[]) => {
  console.log(...out(chalk.bgBlue(" LOG "), ...content))
}

/**
 * Add a warn to stdout
 * @param content things you want to print
 */
export const warn = (...content: any[]) => {
  console.warn(...out(chalk.bgYellow(" WARN "), ...content))
}

/**
 * Add an error to stdout
 * @param content things you want to print
 */
export const error = (...content: any[]) => {
  console.error(...out(chalk.bgRed(" ERROR "), ...content))
}
