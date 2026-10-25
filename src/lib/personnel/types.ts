import type { UserRole } from "@/lib/auth/roles";

export type StaffProfile = {
  id: string;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  phone: string | null;
  employee_number: string | null;
  is_active: boolean;
  email_notice_status?: string | null;
  sms_notice_status?: string | null;
};

export type PersonnelAssignment = {
  id: string;
  employee_id: string;
  supervisor_id: string;
  post_id: string;
  duty_location_id: string;
  duty_shift_id: string;
  start_date: string;
};

export type LookupItem = {
  id: string;
  name: string;
  is_active: boolean;
  description?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius_meters?: number | null;
  start_time?: string;
  end_time?: string;
};

export type AssignmentSummary = {
  supervisor_name: string;
  post_name: string;
  location_name: string;
  location_address: string | null;
  shift_name: string;
  shift_start_time: string;
  shift_end_time: string;
  start_date: string;
};

export type HRStaffMember = {
  profile: StaffProfile;
  assignment: PersonnelAssignment | null;
  assignmentSummary: AssignmentSummary | null;
};
