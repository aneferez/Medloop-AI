import { createTheme } from '@mui/material/styles'

const medLoopTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#4338ca', dark: '#312e81', light: '#eef2ff' },
    secondary: { main: '#0f766e', dark: '#115e59', light: '#ccfbf1' },
    background: { default: '#f4f7fb', paper: '#ffffff' },
    error: { main: '#dc2626' },
    warning: { main: '#b45309' },
    text: { primary: '#172033', secondary: '#5f6b7a' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
  },
})

export default medLoopTheme
