import { IconButton, Stack, Tooltip } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'

export default function TableIconActions({
  onEdit,
  onView,
  onDelete,
  editLabel = 'Edit',
  viewLabel = 'View',
  deleteLabel = 'Delete',
}) {
  return (
    <Stack direction="row" spacing={0.25} justifyContent="flex-end" alignItems="center">
      {onView && (
        <Tooltip title={viewLabel} arrow>
          <IconButton size="small" aria-label={viewLabel} onClick={onView}>
            <VisibilityOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {onEdit && (
        <Tooltip title={editLabel} arrow>
          <IconButton size="small" aria-label={editLabel} onClick={onEdit}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {onDelete && (
        <Tooltip title={deleteLabel} arrow>
          <IconButton size="small" aria-label={deleteLabel} color="error" onClick={onDelete}>
            <DeleteOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  )
}
