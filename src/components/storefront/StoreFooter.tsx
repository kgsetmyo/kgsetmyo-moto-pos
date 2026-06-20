import Box from "@mui/joy/Box";
import Link from "next/link";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

export function StoreFooter() {
  return (
    <Box
      component="footer"
      sx={{
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "background.level1",
        mt: 6,
        py: 3,
      }}
    >
      <Stack spacing={1} sx={{ maxWidth: 1200, mx: "auto", px: 2 }}>
        <Typography level="title-sm">Moto Parts Shop</Typography>
        <Typography level="body-sm" textColor="neutral.500">
          Genuine motorcycle spare parts — click & collect at our Yangon store.
        </Typography>
        <Typography level="body-xs" textColor="neutral.500">
          <Link href="/login">Staff login</Link>
        </Typography>
      </Stack>
    </Box>
  );
}
