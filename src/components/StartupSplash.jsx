import { useEffect, useState } from 'react'
import { Box, LinearProgress, Stack, Typography } from '@mui/material'

const DEFAULT_DURATION_MS = 1_200

function StartupSplash({ children, durationMs = DEFAULT_DURATION_MS }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), durationMs)
    return () => window.clearTimeout(timer)
  }, [durationMs])

  return (
    <>
      {children}
      {visible ? (
        <Box
          aria-label="MedLoop AI is starting"
          role="status"
          sx={{
            position: 'fixed',
            zIndex: 1500,
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            px: 3,
            color: 'common.white',
            background: 'radial-gradient(circle at 50% 46%, rgba(64, 199, 174, 0.25), transparent 34%), linear-gradient(145deg, #0b1f33, #0f766e 62%, #2563eb)',
          }}
        >
          <Stack spacing={2.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
            <Box
              alt="MedLoop AI"
              component="img"
              src="/medloop-logo-512.png"
              sx={{
                width: { xs: 132, sm: 164 },
                aspectRatio: '1',
                borderRadius: 4,
                boxShadow: '0 24px 60px rgba(15, 23, 42, 0.36)',
              }}
            />
            <Stack spacing={0.5}>
              <Typography component="strong" variant="h3" fontWeight={800} letterSpacing="-0.03em">MedLoop</Typography>
              <Typography sx={{ color: '#ccfbf1', letterSpacing: '0.1em', textTransform: 'uppercase' }} variant="body2">Care coordination</Typography>
            </Stack>
            <LinearProgress
              aria-hidden="true"
              sx={{
                width: { xs: 210, sm: 250 },
                height: 5,
                borderRadius: 999,
                bgcolor: 'rgba(255,255,255,0.2)',
                '& .MuiLinearProgress-bar': { bgcolor: '#5eead4' },
              }}
            />
          </Stack>
        </Box>
      ) : null}
    </>
  )
}

export default StartupSplash
