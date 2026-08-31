import { createTheme } from '@mui/material/styles'

const medLoopTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0f766e', dark: '#0b5b55', light: '#e6f6f3' },
    secondary: { main: '#0f9d8a', dark: '#087c73', light: '#e4f4f1' },
    background: { default: '#f4f7fa', paper: '#ffffff' },
    error: { main: '#c2413a' },
    warning: { main: '#a15c00' },
    text: { primary: '#102a43', secondary: '#627d98' },
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
