'use client'

import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { ThemeProvider as StyledThemeProvider } from 'styled-components'
import CssBaseline from '@mui/material/CssBaseline'
import { theme } from './theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <MuiThemeProvider theme={theme}>
      <StyledThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </StyledThemeProvider>
    </MuiThemeProvider>
  )
}
