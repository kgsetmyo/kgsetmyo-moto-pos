import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
      <IconButton
        size="sm"
        variant="outlined"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeftIcon />
      </IconButton>
      <Typography level="body-sm">
        Page {page} of {totalPages}
      </Typography>
      <IconButton
        size="sm"
        variant="outlined"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRightIcon />
      </IconButton>
    </Stack>
  );
}
