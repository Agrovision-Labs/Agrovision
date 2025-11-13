import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// --- NEW MUI IMPORTS ---
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Create a basic, clean theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#007bff', // Your brand blue
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif'
    ].join(','),
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* --- NEW THEME PROVIDER --- */}
      <ThemeProvider theme={theme}>
        <CssBaseline /> {/* This resets CSS for consistency */}
        <App />
      </ThemeProvider>
      {/* --- END NEW THEME PROVIDER --- */}
    </BrowserRouter>
  </React.StrictMode>,
)