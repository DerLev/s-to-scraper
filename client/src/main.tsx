import React from "react"
import ReactDOM from "react-dom/client"
import "@mantine/core/styles.css"
import { MantineProvider, AppShell } from "@mantine/core"
import CmdPalette from "./CmdPalette.tsx"
import { HashRouter, Route, Routes } from "react-router-dom"
import Index from "./pages/index.tsx"
import Dashboard from "./pages/dashboard.tsx"
import Add from "./pages/add.tsx"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="dark">
      <AppShell p="md">
        <CmdPalette />
        <HashRouter>
          <Routes>
            <Route path="/" element={<Index />}></Route>
            <Route path="/dashboard" element={<Dashboard />}></Route>
            <Route path="/add" element={<Add />}></Route>
          </Routes>
        </HashRouter>
      </AppShell>
    </MantineProvider>
  </React.StrictMode>,
)
