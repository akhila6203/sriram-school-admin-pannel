import { Box, Button, IconButton, Stack, Typography } from '@mui/material'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import StarOutlinedIcon from '@mui/icons-material/StarOutlined'
import StarBorderOutlinedIcon from '@mui/icons-material/StarBorderOutlined'

import { getImageUrl } from '../utils/imageUrl'

const ACCEPT = 'image/jpeg,image/png,image/webp'


function validateFiles(files) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  for (const f of files) {
    if (!allowed.includes(f.type)) {
      return 'Only JPG, PNG and WebP images are allowed.'
    }
  }
  return null
}

/**
 * Saved images (edit mode) + optional pending files (create mode).
 */
export default function ProductImageGallery({
  images = [],
  pendingFiles = [],
  onAddPending,
  onRemovePending,
  onUploadSaved,
  onMakePrimary,
  onReorder,
  onDeleteSaved,
  disabled = false,
}) {
  return (
    <Stack spacing={2.5}>
      <Box
        sx={{
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 2,
          p: 3,
          textAlign: 'center',
          bgcolor: 'background.default',
        }}
      >
        <CloudUploadOutlinedIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Upload product images (JPG, PNG, WebP). All sizes share this gallery.
        </Typography>
        <Button variant="outlined" component="label" disabled={disabled}>
          Choose images
          <input
            hidden
            type="file"
            accept={ACCEPT}
            multiple
            onChange={(e) => {
              const list = Array.from(e.target.files || [])
              e.target.value = ''
              if (!list.length) return
              const err = validateFiles(list)
              if (err) {
                onAddPending?.(list, err)
                return
              }
              onAddPending?.(list, null)
            }}
          />
        </Button>
      </Box>

      {(pendingFiles.length > 0 || images.length > 0) && (
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          {pendingFiles.map((file, idx) => (
            <Box
              key={`pending-${file.name}-${idx}`}
              sx={{
                width: { xs: '100%', sm: 148 },
                maxWidth: 148,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.5,
                p: 1,
              }}
            >
              <Box
  component="img"
  src={URL.createObjectURL(file)}
  alt=""
  sx={{
    width: '100%',
    height: 96,
    objectFit: 'cover',
    borderRadius: 1,
  }}
/>
              {/* <Box
                // component="img"
                src={getImageUrl(img.url)}
                src={URL.createObjectURL(file)}
                alt=""
                sx={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: 1 }}
              /> */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.75 }}>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 100 }}>
                  Pending
                </Typography>
                <IconButton size="small" color="error" aria-label="Remove" onClick={() => onRemovePending?.(idx)}>
                  <DeleteOutlinedIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          ))}

          {images.map((img, idx) => (
            <Box
              key={img.id}
              sx={{
                width: { xs: '100%', sm: 148 },
                maxWidth: 148,
                border: '1px solid',
                borderColor: img.isPrimary ? 'primary.main' : 'divider',
                borderRadius: 1.5,
                p: 1,
              }}
            >
              <Box
  component="img"
  src={getImageUrl(img.url)}
  alt=""
  sx={{
    width: '100%',
    height: 96,
    objectFit: 'cover',
    borderRadius: 1,
  }}
/>
              {/* <Box component="img" src={img.url} alt="" sx={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: 1 }} /> */}
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }} flexWrap="wrap">
                <IconButton
                  size="small"
                  aria-label={img.isPrimary ? 'Primary image' : 'Set as primary'}
                  color={img.isPrimary ? 'primary' : 'default'}
                  onClick={() => onMakePrimary?.(img)}
                >
                  {img.isPrimary ? <StarOutlinedIcon fontSize="small" /> : <StarBorderOutlinedIcon fontSize="small" />}
                </IconButton>
                <Button size="small" disabled={idx === 0} onClick={() => onReorder?.(idx, idx - 1)}>
                  Up
                </Button>
                <IconButton size="small" color="error" aria-label="Delete image" onClick={() => onDeleteSaved?.(img)}>
                  <DeleteOutlinedIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {onUploadSaved && (
        <Typography variant="caption" color="text.secondary">
          Images upload immediately when you choose files on a saved product.
        </Typography>
      )}
    </Stack>
  )
}
