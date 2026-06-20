import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <Stack spacing={1}>
      {Array.from({ length: rows }).map((_, row) => (
        <Stack key={row} direction="row" spacing={1}>
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton
              key={col}
              variant="rectangular"
              height={40}
              sx={{ flex: 1, borderRadius: "sm" }}
            />
          ))}
        </Stack>
      ))}
    </Stack>
  );
}

export function CardSkeleton() {
  return (
    <Stack spacing={1}>
      <Skeleton variant="text" width="40%" />
      <Skeleton variant="rectangular" height={80} sx={{ borderRadius: "md" }} />
    </Stack>
  );
}

export function PosSkeleton() {
  return (
    <Stack direction="row" spacing={2} sx={{ height: "70vh" }}>
      <Skeleton variant="rectangular" sx={{ flex: 2, borderRadius: "md" }} />
      <Skeleton variant="rectangular" sx={{ flex: 1, borderRadius: "md" }} />
    </Stack>
  );
}
