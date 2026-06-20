import { createAdminClient } from "@/lib/supabase/admin";
import { assertDayOpen } from "@/lib/data/daily-close";

export async function createExpense(input: {
  category: string;
  description?: string;
  amount: number;
  expenseDate: string;
  recordedById: string;
}) {
  await assertDayOpen(input.expenseDate);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      category: input.category,
      description: input.description,
      amount: input.amount,
      expense_date: input.expenseDate,
      recorded_by: input.recordedById,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listExpenses(from: string, to: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
