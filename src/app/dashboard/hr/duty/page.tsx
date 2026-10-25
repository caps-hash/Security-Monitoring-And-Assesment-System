import type { Metadata } from "next";
import { DutyAssignmentManagement } from "@/components/duty-assignment-management";
import { ShiftWorkdaysForm } from "@/components/shift-workdays-form";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { getDutyManagementData } from "@/lib/personnel/duty-management";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Duty assignment",
};

export default async function HrDutyPage() {
  const data = await getDutyManagementData();
  const supabase = await createSupabaseServerClient();
  const shiftsResult = await supabase
    .from("duty_shifts")
    .select("id, name, start_time, end_time, scheduled_weekdays")
    .order("name");
  const shifts = shiftsResult.error
    ? []
    : shiftsResult.data.map((shift) => ({
        id: shift.id,
        name: shift.name,
        startTime: shift.start_time,
        endTime: shift.end_time,
        weekdays: shift.scheduled_weekdays,
      }));

  return (
    <DashboardPlaceholder profile={data.profile} role="hr">
      <DutyAssignmentManagement
        configurations={data.configurations}
        unlinked={data.unlinked}
      />
      {shiftsResult.error ? (
        <p className="mt-6 text-sm text-amber-800" role="status">
          Shift workdays are unavailable until supabase/schema.sql is applied.
        </p>
      ) : (
        <ShiftWorkdaysForm shifts={shifts} />
      )}
    </DashboardPlaceholder>
  );
}
