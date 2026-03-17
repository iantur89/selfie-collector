import { ReactNode } from 'react'
import { AppLogo } from '@atoms'
import { Box, Typography, Button } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import Link from 'next/link'

interface AppPageLayoutProps {
  title: string
  children: ReactNode
}

export function PageLayout({ title, children }: AppPageLayoutProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box
        component="header"
        sx={{
          p: 2,
          px: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <AppLogo width={32} height={32} />
        <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        <Button component={Link} href="/" variant="text" startIcon={<ArrowBackIcon />} sx={{ color: 'text.secondary' }}>
          Back to Home
        </Button>
      </Box>
      <Box sx={{ flex: 1, p: 3, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
        <Box sx={{ width: '100%', maxWidth: 'md', height: '100%', display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}
