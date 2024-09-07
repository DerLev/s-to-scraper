/* prepend the dev server url when in dev mode */
const apiBaseUrl = () =>
  import.meta.env.MODE === "development" ? "http://localhost:3000/api" : "/api"

export default apiBaseUrl
