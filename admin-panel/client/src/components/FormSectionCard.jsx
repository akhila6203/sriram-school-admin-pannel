import { Card, CardContent, Typography } from '@mui/material'

export default function FormSectionCard({ title, description, children, sx }) {
  return (
    <Card variant="outlined" sx={sx}>
      <CardContent sx={{ p: { xs: 2, md: 3 }, '&:last-child': { pb: { xs: 2, md: 3 } } }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: description ? 0.5 : 2 }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            {description}
          </Typography>
        )}
        {children}
      </CardContent>
    </Card>
  )
}
