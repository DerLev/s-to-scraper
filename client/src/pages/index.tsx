import "@mantine/core/styles.css"
import { useEffect } from "react"

const Index = () => {
  useEffect(() => {
    window.location.replace(window.location.origin + "/#/dashboard")
  }, [])

  return <></>
}

export default Index
