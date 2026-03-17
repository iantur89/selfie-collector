import styled from 'styled-components'
import { Paper } from '@mui/material'
import type { Theme } from '@mui/material/styles'

export const MessageBubble = styled(Paper)<{ $isUser: boolean }>`
  max-width: 80%;
  padding: ${({ theme }) => (theme as Theme).spacing(1.5, 2)};
  border-radius: ${({ theme }) => (theme as Theme).spacing(2.5)};
  ${({ $isUser, theme }) =>
    $isUser
      ? `
    background-color: ${(theme as Theme).palette.primary.main};
    color: ${(theme as Theme).palette.primary.contrastText};
    border-bottom-right-radius: ${(theme as Theme).spacing(0.5)};
  `
      : `
    background-color: ${(theme as Theme).palette.grey[200]};
    color: ${(theme as Theme).palette.text.primary};
    border-bottom-left-radius: ${(theme as Theme).spacing(0.5)};
  `}
`
