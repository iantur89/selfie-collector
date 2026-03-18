'use client'

import { AppLogo } from '@atoms'
import Link from 'next/link'
import { Box, Typography, Card, CardActionArea, Container, Stack } from '@mui/material'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import StreamIcon from '@mui/icons-material/Stream'
import ExtensionIcon from '@mui/icons-material/Extension'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

export default function Home() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
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
          zIndex: 10,
        }}
      >
        <AppLogo width={32} height={32} />
        <Typography variant="h6" fontWeight="bold">
          A3 Example
        </Typography>
      </Box>

      <Box sx={{ flex: 1, p: 3, overflowY: 'auto' }}>
        <Container maxWidth="lg" sx={{ mt: 5, mb: 10 }}>
          <Stack spacing={3} alignItems="center" mb={10} textAlign="center">
            <Typography variant="h3" fontWeight={800} color="text.primary">
              Welcome to A3 Core
            </Typography>
            <Typography variant="h6" color="text.secondary" maxWidth="md">
              Explore the different communication protocols and frontend implementations available in the A3
              architecture.
            </Typography>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
            {/* Blocking Chat Card */}
            <Card
              elevation={0}
              sx={{
                flex: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 4,
                transition: '0.2s',
                '&:hover': { borderColor: 'primary.main', transform: 'translateY(-4px)', boxShadow: 4 },
              }}
            >
              <CardActionArea
                component={Link}
                href="/chat"
                sx={{
                  p: 4,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                }}
              >
                <Box sx={{ p: 2, bgcolor: 'rgba(37, 99, 235, 0.1)', color: 'primary.main', borderRadius: 2 }}>
                  <ChatBubbleOutlineIcon fontSize="large" />
                </Box>
                <Typography variant="h5" fontWeight="bold">
                  Blocking Chat
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ flexGrow: 1 }}>
                  A synchronous (unary) chat implementation. The client waits for the agent to finish processing
                  completely before rendering.
                </Typography>
                <Stack direction="row" alignItems="center" gap={1} color="primary.main" fontWeight="bold" mt={2}>
                  Try it out <ArrowForwardIcon fontSize="small" />
                </Stack>
              </CardActionArea>
            </Card>

            {/* Streaming Chat Card */}
            <Card
              elevation={0}
              sx={{
                flex: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 4,
                transition: '0.2s',
                '&:hover': { borderColor: '#9c27b0', transform: 'translateY(-4px)', boxShadow: 4 },
              }}
            >
              <CardActionArea
                component={Link}
                href="/stream"
                sx={{
                  p: 4,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                }}
              >
                <Box sx={{ p: 2, bgcolor: 'rgba(156, 39, 176, 0.1)', color: '#9c27b0', borderRadius: 2 }}>
                  <StreamIcon fontSize="large" />
                </Box>
                <Typography variant="h5" fontWeight="bold">
                  Streaming Chat
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ flexGrow: 1 }}>
                  A streaming response implementation using Server-Sent Events (SSE). The client renders the agent's
                  response incrementally as it's being generated.
                </Typography>
                <Stack direction="row" alignItems="center" gap={1} color="#9c27b0" fontWeight="bold" mt={2}>
                  Try it out <ArrowForwardIcon fontSize="small" />
                </Stack>
              </CardActionArea>
            </Card>

            {/* AG-UI Protocol Card */}
            <Card
              elevation={0}
              sx={{
                flex: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 4,
                transition: '0.2s',
                '&:hover': { borderColor: '#2e7d32', transform: 'translateY(-4px)', boxShadow: 4 },
              }}
            >
              <CardActionArea
                component={Link}
                href="/agui"
                sx={{
                  p: 4,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                }}
              >
                <Box sx={{ p: 2, bgcolor: 'rgba(46, 125, 50, 0.1)', color: '#2e7d32', borderRadius: 2 }}>
                  <ExtensionIcon fontSize="large" />
                </Box>
                <Typography variant="h5" fontWeight="bold">
                  AG-UI Protocol
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ flexGrow: 1 }}>
                  Agentic UI implementation. The agent returns structured semantic UI components alongside its state and
                  logic, driving the client dynamic interface.
                </Typography>
                <Stack direction="row" alignItems="center" gap={1} color="#2e7d32" fontWeight="bold" mt={2}>
                  Try it out <ArrowForwardIcon fontSize="small" />
                </Stack>
              </CardActionArea>
            </Card>

            <Card
              elevation={0}
              sx={{
                flex: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 4,
                transition: '0.2s',
                '&:hover': { borderColor: '#7f1d1d', transform: 'translateY(-4px)', boxShadow: 4 },
              }}
            >
              <CardActionArea
                component={Link}
                href="/admin/users"
                sx={{
                  p: 4,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                }}
              >
                <Box sx={{ p: 2, bgcolor: 'rgba(127, 29, 29, 0.1)', color: '#7f1d1d', borderRadius: 2 }}>
                  <AdminPanelSettingsIcon fontSize="large" />
                </Box>
                <Typography variant="h5" fontWeight="bold">
                  Admin Users
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ flexGrow: 1 }}>
                  Inspect user chat session state, review dataset-linked records, and reset a user session when needed.
                </Typography>
                <Stack direction="row" alignItems="center" gap={1} color="#7f1d1d" fontWeight="bold" mt={2}>
                  Open dashboard <ArrowForwardIcon fontSize="small" />
                </Stack>
              </CardActionArea>
            </Card>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}
