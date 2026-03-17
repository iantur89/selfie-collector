import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: {
      main: '#2563eb',
    },
    background: {
      default: '#f9fafb',
      paper: '#ffffff',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { maxWidth: '100vw', overflowX: 'hidden' },
        body: { maxWidth: '100vw', overflowX: 'hidden' },
        a: { color: 'inherit', textDecoration: 'none' },
      },
    },
  },
})
