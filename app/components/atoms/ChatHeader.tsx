'use client'

import styled from 'styled-components'
import type { Theme } from '@mui/material/styles'

export const ChatHeader = styled.div`
  border-bottom: 1px solid ${({ theme }) => (theme as Theme).palette.divider};
  background-color: ${({ theme }) => (theme as Theme).palette.background.paper};
  padding: ${({ theme }) => (theme as Theme).spacing(2, 3)};
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
`
