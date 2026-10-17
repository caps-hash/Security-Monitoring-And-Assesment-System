"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedProfile } from "@/lib/auth/profile";

export type ActionState = {
  error: string | null;
  success: string | null;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function requireHr() {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "hr") {
    throw new Error("Only HR users can manage personnel.");
  }
  return profile;
}

function failed(message: string): ActionState {
  return { error: message, success: null };
}

function succeeded(message: string): ActionState {
  return { error: null, success: message };
}

export async function createStaffAccount(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireHr();

  const email = field(formData, "email").toLowerCase();
  const firstName = field(formData, "first_name");
  const lastName = field(formData, "last_name");
  const employeeNumber = field(formData, "employee_number");
  const phone = field(formData, "phone");
  const role = field(formData, "role");

  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !firstName ||
    !lastName ||
    (role !== "employee" && role !== "supervisor")
  ) {
    return failed("Enter a valid email, first and last name, and staff role.");
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { first_name: firstName, last_name: lastName },
  });

  if (error) {
    return failed(`Could not invite this account: ${error.message}`);
  }
  if (!data.user) {
    throw new Error("Supabase accepted the invitation but returned no user.");
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .update({
      role,
      first_name: firstName,
      last_name: lastName,
      employee_number: employeeNumber || null,
      phone: phone || null,
    })
    .eq("id", data.user.id)
    .select("id")
    .maybeSingle();

  if (profileError) {
    return failed(
      `The invitation was sent, but the staff profile could not be saved: ${profileError.message}`,
    );
  }
  if (!profile) {
    throw new Error("The invitation was sent but its profile was not created.");
  }

  revalidatePath("/dashboard/hr");
  return succeeded(`Invitation sent to ${email}.`);
}

export async function updateStaffProfile(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireHr();

  const id = field(formData, "id");
  const firstName = field(formData, "first_name");
  const lastName = field(formData, "last_name");
  const employeeNumber = field(formData, "employee_number");
  const phone = field(formData, "phone");

  if (!uuidPattern.test(id) || !firstName || !lastName) {
    return failed("Enter a valid first and last name.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      employee_number: employeeNumber || null,
      phone: phone || null,
    })
    .eq("id", id)
    .in("role", ["employee", "supervisor"])
    .select("id")
    .maybeSingle();

  if (error) {
    return failed(`Could not update this profile: ${error.message}`);
  }
  if (!data) {
    return failed("The staff account was not found.");
  }

  revalidatePath("/dashboard/hr");
  revalidatePath("/dashboard/supervisor");
  revalidatePath("/dashboard/employee");
  return succeeded("Profile updated.");
}

export async function setStaffActive(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireHr();
  const id = field(formData, "id");
  const activeValue = field(formData, "active");

  if (!uuidPattern.test(id) || (activeValue !== "true" && activeValue !== "false")) {
    return failed("Invalid account activation request.");
  }
  if (id === actor.id) {
    return failed("You cannot deactivate your own HR account.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_active: activeValue === "true" })
    .eq("id", id)
    .in("role", ["employee", "supervisor"])
    .select("id")
    .maybeSingle();

  if (error) {
    return failed(`Could not update this account: ${error.message}`);
  }
  if (!data) {
    return failed("The staff account was not found.");
  }

  revalidatePath("/dashboard/hr");
  revalidatePath("/dashboard/supervisor");
  revalidatePath("/dashboard/employee");
  return succeeded(
    activeValue === "true" ? "Account activated." : "Account deactivated.",
  );
}

export async function saveAssignment(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireHr();

  const employeeId = field(formData, "employee_id");
  const supervisorId = field(formData, "supervisor_id");
  const postId = field(formData, "post_id");
  const locationId = field(formData, "duty_location_id");
  const shiftId = field(formData, "duty_shift_id");
  const startDate = field(formData, "start_date");

  if (
    ![employeeId, supervisorId, postId, locationId, shiftId].every((id) =>
      uuidPattern.test(id),
    ) ||
    !isValidDate(startDate)
  ) {
    return failed("Choose an employee, supervisor, post, location, shift, and start date.");
  }

  function isValidDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const parsedDate = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsedDate.valueOf()) &&
      parsedDate.toISOString().slice(0, 10) === value
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("personnel_assignments").upsert(
    {
      employee_id: employeeId,
      supervisor_id: supervisorId,
      post_id: postId,
      duty_location_id: locationId,
      duty_shift_id: shiftId,
      start_date: startDate,
    },
    { onConflict: "employee_id" },
  );

  if (error) {
    return failed(`Could not save the assignment: ${error.message}`);
  }

  revalidatePath("/dashboard/hr");
  revalidatePath("/dashboard/supervisor");
  revalidatePath("/dashboard/employee");
  return succeeded("Assignment saved.");
}

export async function saveLookup(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireHr();

  const kind = field(formData, "kind");
  const id = field(formData, "id");
  const name = field(formData, "name");
  const active = formData.get("is_active") === "on";

  if (
    !["posts", "duty_locations", "duty_shifts"].includes(kind) ||
    (id && !uuidPattern.test(id)) ||
    !name
  ) {
    return failed("Enter a valid name for this item.");
  }

  const supabase = await createSupabaseServerClient();
  let error: { message: string } | null = null;

  if (kind === "posts") {
    const description = field(formData, "description") || null;
    const result = id
      ? await supabase
          .from("posts")
          .update({ name, description, is_active: active })
          .eq("id", id)
      : await supabase.from("posts").insert({ name, description, is_active: active });
    error = result.error;
  } else if (kind === "duty_locations") {
    const address = field(formData, "address") || null;
    const result = id
      ? await supabase
          .from("duty_locations")
          .update({ name, address, is_active: active })
          .eq("id", id)
      : await supabase
          .from("duty_locations")
          .insert({ name, address, is_active: active });
    error = result.error;
  } else {
    const startTime = field(formData, "start_time");
    const endTime = field(formData, "end_time");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) {
      return failed("Enter valid start and end times for the duty shift.");
    }

    const result = id
      ? await supabase
          .from("duty_shifts")
          .update({
            name,
            start_time: startTime,
            end_time: endTime,
            is_active: active,
          })
          .eq("id", id)
      : await supabase
          .from("duty_shifts")
          .insert({
            name,
            start_time: startTime,
            end_time: endTime,
            is_active: active,
          });
    error = result.error;
  }

  if (error) {
    return failed(`Could not save this item: ${error.message}`);
  }

  revalidatePath("/dashboard/hr");
  revalidatePath("/dashboard/supervisor");
  revalidatePath("/dashboard/employee");
  return succeeded(id ? "Item updated." : "Item added.");
}
