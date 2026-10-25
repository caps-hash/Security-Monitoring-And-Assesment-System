export type DutyContext = {
  assignmentId: string;
  postName: string;
  locationName: string;
  locationAddress: string | null;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  startDate: string;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
};

export type AttendanceView = {
  id: string;
  employeeName: string;
  employeeNumber: string | null;
  attendanceDate: string;
  postName: string;
  locationName: string;
  shiftLabel: string;
  timeInLabel: string;
  timeOutLabel: string;
  durationLabel: string;
  status: "open" | "completed";
  timeInVerification: string;
  timeOutVerification: string;
  shiftNote: string;
  overnight: boolean;
  timeInPhotoUrl: string | null;
  timeOutPhotoUrl: string | null;
  timeInCoordinates: string;
  timeOutCoordinates: string;
  timeInPlace: string | null;
  timeOutPlace: string | null;
};

export type AttendanceFilters = {
  from: string;
  to: string;
  status: "" | "open" | "completed";
  employeeId: string;
  locationId: string;
  page: number;
};

export type MonitorData = {
  schemaReady: boolean;
  message: string | null;
  filters: AttendanceFilters;
  pageCount: number;
  records: AttendanceView[];
  summaries: {
    records: number;
    completed: number;
    missingTimeOut: number;
    late: number;
    noTimeIn: number | null;
  };
  employees: { id: string; name: string }[];
  locations: { id: string; name: string }[];
};
