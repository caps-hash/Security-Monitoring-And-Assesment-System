"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WorkdayState = { error: string | null; success: string | null };

export async function saveShiftWorkdays(
  _previous: WorkdayState,
  formData: FormData,
): Promise<WorkdayState> {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "hr") {
    return { error: "Only HR can configure shift workdays.", success: null };
  }
  const shiftId = String(formData.get("shiftId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(shiftId)) {
    return { error: "Choose a duty shift.", success: null };
  }
  const clear = formData.get("clear") === "1";
  const weekdays = clear
    ? null
    : [...new Set(formData.getAll("weekday").map((value) => Number(value)))]
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        .sort((left, right) => left - right);
  if (!clear && weekdays?.length === 0) {
    return {
      error: "Select at least one weekday, or clear the schedule. No default workweek is saved.",
      success: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("duty_shifts")
    .update({ scheduled_weekdays: weekdays })
    .eq("id", shiftId);
  if (error) {
    return {
      error: /scheduled_weekdays/i.test(error.message)
        ? "Shift workdays are unavailable until supabase/schema.sql is applied."
        : error.message,
      success: null,
    };
  }
  revalidatePath("/dashboard/hr/duty");
  revalidatePath("/dashboard/hr/attendance");
  return {
    error: null,
    success: weekdays
      ? "Shift workdays saved. Only those weekdays count as expected attendance."
      : "Shift workdays cleared. Those days are not counted as expected work or absences.",
  };
}
