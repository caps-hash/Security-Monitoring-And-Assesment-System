import { requireRole, type AuthenticatedProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DutyConfigurationRecord = {
  id: string | null;
  postId: string;
  locationId: string;
  shiftId: string;
  postName: string;
  postDescription: string | null;
  locationName: string;
  locationAddress: string | null;
  shiftName: string;
  startTime: string;
  endTime: string;
  postActive: boolean;
  locationActive: boolean;
  shiftActive: boolean;
  assignmentCount: number;
  sharedPostUses: number;
  sharedLocationUses: number;
  sharedShiftUses: number;
};

export type UnlinkedDutyRecord = {
  kind: "post" | "location" | "shift";
  id: string;
  name: string;
  detail: string | null;
  isActive: boolean;
};

export type DutyManagementData = {
  profile: AuthenticatedProfile;
  configurations: DutyConfigurationRecord[];
  unlinked: UnlinkedDutyRecord[];
};

type PostRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

type LocationRow = {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
};

type ShiftRow = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

type BundleRef = {
  post_id: string;
  duty_location_id: string;
  duty_shift_id: string;
};

function bundleKey(bundle: BundleRef): string {
  return `${bundle.post_id}:${bundle.duty_location_id}:${bundle.duty_shift_id}`;
}

function sameBundle(left: BundleRef, right: BundleRef): boolean {
  return bundleKey(left) === bundleKey(right);
}

export async function getDutyManagementData(): Promise<DutyManagementData> {
  const profile = await requireRole("hr");
  const supabase = await createSupabaseServerClient();
  const [postsResult, locationsResult, shiftsResult, assignmentsResult, configurationsResult] =
    await Promise.all([
      supabase.from("posts").select("id, name, description, is_active").order("name"),
      supabase
        .from("duty_locations")
        .select("id, name, address, is_active")
        .order("name"),
      supabase
        .from("duty_shifts")
        .select("id, name, start_time, end_time, is_active")
        .order("name"),
      supabase
        .from("personnel_assignments")
        .select("post_id, duty_location_id, duty_shift_id"),
      supabase
        .from("duty_configurations")
        .select("id, post_id, duty_location_id, duty_shift_id"),
    ]);

  if (postsResult.error) {
    throw new Error(`Unable to load posts: ${postsResult.error.message}`);
  }
  if (locationsResult.error) {
    throw new Error(`Unable to load duty locations: ${locationsResult.error.message}`);
  }
  if (shiftsResult.error) {
    throw new Error(`Unable to load duty shifts: ${shiftsResult.error.message}`);
  }
  if (assignmentsResult.error) {
    throw new Error(
      `Unable to load personnel assignments: ${assignmentsResult.error.message}`,
    );
  }
  if (configurationsResult.error) {
    throw new Error(
      `Unable to load duty configurations: ${configurationsResult.error.message}. Re-run supabase/schema.sql if this table is missing.`,
    );
  }

  const posts = new Map(postsResult.data.map((post) => [post.id, post as PostRow]));
  const locations = new Map(
    locationsResult.data.map((location) => [location.id, location as LocationRow]),
  );
  const shifts = new Map(shiftsResult.data.map((shift) => [shift.id, shift as ShiftRow]));
  const assignments = assignmentsResult.data;
  const storedConfigurations = configurationsResult.data;
  const bundles = new Map<string, BundleRef & { id: string | null }>();

  for (const configuration of storedConfigurations) {
    bundles.set(bundleKey(configuration), { ...configuration, id: configuration.id });
  }
  for (const assignment of assignments) {
    const key = bundleKey(assignment);
    if (!bundles.has(key)) {
      bundles.set(key, { ...assignment, id: null });
    }
  }

  const configurations = [...bundles.values()].flatMap((bundle) => {
    const post = posts.get(bundle.post_id);
    const location = locations.get(bundle.duty_location_id);
    const shift = shifts.get(bundle.duty_shift_id);
    if (!post || !location || !shift) {
      return [];
    }

    const assignmentCount = assignments.filter((assignment) =>
      sameBundle(assignment, bundle),
    ).length;
    const sharedPostUses =
      assignments.filter(
        (assignment) =>
          assignment.post_id === bundle.post_id && !sameBundle(assignment, bundle),
      ).length +
      storedConfigurations.filter(
        (configuration) =>
          configuration.post_id === bundle.post_id && !sameBundle(configuration, bundle),
      ).length;
    const sharedLocationUses =
      assignments.filter(
        (assignment) =>
          assignment.duty_location_id === bundle.duty_location_id &&
          !sameBundle(assignment, bundle),
      ).length +
      storedConfigurations.filter(
        (configuration) =>
          configuration.duty_location_id === bundle.duty_location_id &&
          !sameBundle(configuration, bundle),
      ).length;
    const sharedShiftUses =
      assignments.filter(
        (assignment) =>
          assignment.duty_shift_id === bundle.duty_shift_id &&
          !sameBundle(assignment, bundle),
      ).length +
      storedConfigurations.filter(
        (configuration) =>
          configuration.duty_shift_id === bundle.duty_shift_id &&
          !sameBundle(configuration, bundle),
      ).length;

    return [
      {
        id: bundle.id,
        postId: post.id,
        locationId: location.id,
        shiftId: shift.id,
        postName: post.name,
        postDescription: post.description,
        locationName: location.name,
        locationAddress: location.address,
        shiftName: shift.name,
        startTime: shift.start_time,
        endTime: shift.end_time,
        postActive: post.is_active,
        locationActive: location.is_active,
        shiftActive: shift.is_active,
        assignmentCount,
        sharedPostUses,
        sharedLocationUses,
        sharedShiftUses,
      },
    ];
  });

  configurations.sort(
    (left, right) =>
      left.postName.localeCompare(right.postName) ||
      left.locationName.localeCompare(right.locationName) ||
      left.shiftName.localeCompare(right.shiftName),
  );

  const linkedPostIds = new Set(configurations.map((item) => item.postId));
  const linkedLocationIds = new Set(configurations.map((item) => item.locationId));
  const linkedShiftIds = new Set(configurations.map((item) => item.shiftId));
  const unlinked: UnlinkedDutyRecord[] = [
    ...postsResult.data
      .filter((post) => !linkedPostIds.has(post.id))
      .map((post) => ({
        kind: "post" as const,
        id: post.id,
        name: post.name,
        detail: post.description,
        isActive: post.is_active,
      })),
    ...locationsResult.data
      .filter((location) => !linkedLocationIds.has(location.id))
      .map((location) => ({
        kind: "location" as const,
        id: location.id,
        name: location.name,
        detail: location.address,
        isActive: location.is_active,
      })),
    ...shiftsResult.data
      .filter((shift) => !linkedShiftIds.has(shift.id))
      .map((shift) => ({
        kind: "shift" as const,
        id: shift.id,
        name: shift.name,
        detail: `${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)}`,
        isActive: shift.is_active,
      })),
  ];

  return { profile, configurations, unlinked };
}
