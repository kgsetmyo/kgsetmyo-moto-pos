import Typography from "@mui/joy/Typography";
import Stack from "@mui/joy/Stack";
import { PosCheckout } from "@/components/pos/PosCheckout";

export default function PosPage() {
  return (
    <Stack spacing={2}>
      <Typography level="h2">Point of Sale</Typography>
      <PosCheckout />
    </Stack>
  );
}
