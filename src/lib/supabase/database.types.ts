import type { UserRole } from "@/lib/auth/roles";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          role: UserRole;
          first_name: string;
          middle_name: string | null;
          last_name: string;
          phone: string | null;
          employee_number: string | null;
          is_active: boolean;
          email_notice_status: string | null;
          sms_notice_status: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role?: UserRole;
          first_name?: string;
          middle_name?: string | null;
          last_name?: string;
          phone?: string | null;
          employee_number?: string | null;
          is_active?: boolean;
          email_notice_status?: string | null;
          sms_notice_status?: string | null;
          created_at?: string;
        };
        Update: {
          email?: string;
          role?: UserRole;
          first_name?: string;
          middle_name?: string | null;
          last_name?: string;
          phone?: string | null;
          employee_number?: string | null;
          is_active?: boolean;
          email_notice_status?: string | null;
          sms_notice_status?: string | null;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      duty_locations: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          geofence_radius_meters: number | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          geofence_radius_meters?: number | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          geofence_radius_meters?: number | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      duty_shifts: {
        Row: {
          id: string;
          name: string;
          start_time: string;
          end_time: string;
          scheduled_weekdays: number[] | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          start_time: string;
          end_time: string;
          scheduled_weekdays?: number[] | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          start_time?: string;
          end_time?: string;
          scheduled_weekdays?: number[] | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      personnel_assignments: {
        Row: {
          id: string;
          employee_id: string;
          supervisor_id: string;
          post_id: string;
          duty_location_id: string;
          duty_shift_id: string;
          start_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          supervisor_id: string;
          post_id: string;
          duty_location_id: string;
          duty_shift_id: string;
          start_date: string;
          created_at?: string;
        };
        Update: {
          supervisor_id?: string;
          post_id?: string;
          duty_location_id?: string;
          duty_shift_id?: string;
          start_date?: string;
        };
        Relationships: [];
      };
      attendance_records: {
        Row: {
          id: string;
          employee_id: string;
          assignment_id: string;
          post_id: string;
          duty_location_id: string;
          duty_shift_id: string;
          attendance_date: string;
          time_in_at: string;
          time_out_at: string | null;
          time_in_captured_at: string | null;
          time_out_captured_at: string | null;
          time_in_latitude: number;
          time_in_longitude: number;
          time_in_accuracy_m: number;
          time_out_latitude: number | null;
          time_out_longitude: number | null;
          time_out_accuracy_m: number | null;
          time_in_location_label: string | null;
          time_out_location_label: string | null;
          time_in_photo_path: string;
          time_out_photo_path: string | null;
          time_in_verification: "inside_geofence" | "gps_captured_no_geofence";
          time_out_verification: "inside_geofence" | "gps_captured_no_geofence" | null;
          shift_note: "early" | "on_time" | "late" | "outside_window" | null;
          status: "open" | "completed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          employee_id: string;
          assignment_id: string;
          post_id: string;
          duty_location_id: string;
          duty_shift_id: string;
          attendance_date?: string;
          time_in_at?: string;
          time_out_at?: string | null;
          time_in_captured_at?: string | null;
          time_out_captured_at?: string | null;
          time_in_latitude: number;
          time_in_longitude: number;
          time_in_accuracy_m: number;
          time_out_latitude?: number | null;
          time_out_longitude?: number | null;
          time_out_accuracy_m?: number | null;
          time_in_location_label?: string | null;
          time_out_location_label?: string | null;
          time_in_photo_path: string;
          time_out_photo_path?: string | null;
          time_in_verification: "inside_geofence" | "gps_captured_no_geofence";
          time_out_verification?: "inside_geofence" | "gps_captured_no_geofence" | null;
          shift_note?: "early" | "on_time" | "late" | "outside_window" | null;
          status?: "open" | "completed";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          time_out_captured_at?: string | null;
          time_out_latitude?: number | null;
          time_out_longitude?: number | null;
          time_out_accuracy_m?: number | null;
          time_out_location_label?: string | null;
          time_out_photo_path?: string | null;
          time_out_verification?: "inside_geofence" | "gps_captured_no_geofence" | null;
          time_out_at?: string | null;
          status?: "open" | "completed";
        };
        Relationships: [];
      };
      duty_configurations: {
        Row: {
          id: string;
          post_id: string;
          duty_location_id: string;
          duty_shift_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          duty_location_id: string;
          duty_shift_id: string;
          created_at?: string;
        };
        Update: {
          post_id?: string;
          duty_location_id?: string;
          duty_shift_id?: string;
        };
        Relationships: [];
      };
      assessment_settings: {
        Row: {
          id: number;
          evaluation_1_offset_days: number | null;
          evaluation_2_offset_days: number | null;
          evaluation_3_offset_days: number | null;
          due_soon_days: number | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: number;
          evaluation_1_offset_days?: number | null;
          evaluation_2_offset_days?: number | null;
          evaluation_3_offset_days?: number | null;
          due_soon_days?: number | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          evaluation_1_offset_days?: number | null;
          evaluation_2_offset_days?: number | null;
          evaluation_3_offset_days?: number | null;
          due_soon_days?: number | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      assessments: {
        Row: {
          id: string;
          employee_id: string;
          evaluation_number: number;
          start_date: string;
          due_date: string;
          workflow_status:
            | "scheduled"
            | "submitted"
            | "under_review"
            | "returned_for_correction"
            | "completed";
          latest_note: string | null;
          updated_at: string;
          updated_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          evaluation_number: number;
          start_date: string;
          due_date: string;
          workflow_status?:
            | "scheduled"
            | "submitted"
            | "under_review"
            | "returned_for_correction"
            | "completed";
          latest_note?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          created_at?: string;
        };
        Update: {
          due_date?: string;
          start_date?: string;
          workflow_status?:
            | "scheduled"
            | "submitted"
            | "under_review"
            | "returned_for_correction"
            | "completed";
          latest_note?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      assessment_events: {
        Row: {
          id: string;
          assessment_id: string;
          previous_status: string | null;
          new_status: string;
          actor_id: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          assessment_id: string;
          previous_status?: string | null;
          new_status: string;
          actor_id: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          note?: string | null;
        };
        Relationships: [];
      };
      evaluation_forms: {
        Row: {
          id: string;
          assessment_id: string;
          employee_id: string;
          supervisor_id: string;
          evaluation_number: number;
          position_title: string | null;
          department_section: string | null;
          evaluation_date: string | null;
          form_status: "draft" | "submitted";
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      evaluation_responses: {
        Row: {
          id: string;
          form_id: string;
          criterion_code: string;
          rating: string | null;
          comments: string | null;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      evaluation_files: {
        Row: {
          id: string;
          assessment_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          byte_size: number;
          uploaded_by: string;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      evaluation_corrections: {
        Row: {
          id: string;
          assessment_id: string;
          remarks: string;
          reviewer_id: string;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      evaluation_results: {
        Row: {
          assessment_id: string;
          official_score: number | null;
          calculated_rating: string | null;
          rating_basis: "unconfigured" | "approved_configuration";
          hr_feedback: string | null;
          recommendation: string | null;
          reviewer_id: string | null;
          reviewed_at: string | null;
          released_at: string | null;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      evaluation_acknowledgments: {
        Row: {
          id: string;
          assessment_id: string;
          kind: "rated_by" | "acknowledge_by" | "noted_by_hro";
          actor_id: string;
          acknowledged_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      final_decisions: {
        Row: {
          employee_id: string;
          decision: "passed" | "not_passed";
          remark: string | null;
          issued_by: string;
          issued_at: string;
          released_at: string | null;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      rating_configurations: {
        Row: {
          id: number;
          approved: boolean;
          source_note: string | null;
          approved_by: string | null;
          approved_at: string | null;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      rating_bands: {
        Row: {
          id: string;
          configuration_id: number;
          label: string;
          min_score: number;
          max_score: number;
          sort_order: number;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_is_active: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      current_user_has_role: {
        Args: { required_role: string };
        Returns: boolean;
      };
      save_duty_configuration: {
        Args: {
          configuration_id: string | null;
          post_id: string | null;
          post_name: string;
          post_description: string | null;
          location_id: string | null;
          location_name: string;
          location_address: string | null;
          shift_id: string | null;
          shift_name: string;
          shift_start: string;
          shift_end: string;
          is_active: boolean;
          acknowledge_shared: boolean;
        };
        Returns: {
          configuration_id: string;
          post_id: string;
          location_id: string;
          shift_id: string;
        };
      };
      set_duty_bundle_active: {
        Args: {
          configuration_id: string | null;
          post_id: string;
          location_id: string;
          shift_id: string;
          is_active: boolean;
          acknowledge_shared: boolean;
        };
        Returns: undefined;
      };
      save_assessment_settings: {
        Args: {
          evaluation_1_offset_days: number;
          evaluation_2_offset_days: number;
          evaluation_3_offset_days: number;
          due_soon_days: number;
        };
        Returns: undefined;
      };
      sync_assessment_schedules: {
        Args: Record<PropertyKey, never>;
        Returns: {
          inserted: number;
          updated: number;
          unchanged: number;
          preserved: number;
          missing_start: number;
        };
      };
      set_assessment_workflow: {
        Args: {
          assessment_id: string;
          next_status: string;
          note: string;
        };
        Returns: undefined;
      };
      save_evaluation_draft: {
        Args: {
          target_assessment_id: string;
          evaluation_date: string | null;
          responses: unknown;
        };
        Returns: string;
      };
      submit_evaluation_form: {
        Args: {
          target_assessment_id: string;
          evaluation_date: string;
          responses: unknown;
        };
        Returns: string;
      };
      register_evaluation_file: {
        Args: {
          target_assessment_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          byte_size: number;
        };
        Returns: string;
      };
      save_evaluation_result_fields: {
        Args: {
          target_assessment_id: string;
          official_score: number;
          hr_feedback: string;
          recommendation: string;
        };
        Returns: undefined;
      };
      approve_rating_configuration: {
        Args: {
          bands: unknown;
          source_note: string;
          approve_now: boolean;
        };
        Returns: undefined;
      };
      complete_and_release_evaluation: {
        Args: {
          target_assessment_id: string;
          confirm_release: boolean;
        };
        Returns: undefined;
      };
      recalculate_released_ratings: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      issue_final_decision: {
        Args: {
          target_employee_id: string;
          decision: string;
          remark: string;
          confirm_decision: boolean;
        };
        Returns: undefined;
      };
      release_final_decision: {
        Args: {
          target_employee_id: string;
          confirm_release: boolean;
        };
        Returns: undefined;
      };
      acknowledge_released_evaluation: {
        Args: { target_assessment_id: string };
        Returns: undefined;
      };
      note_evaluation_as_hro: {
        Args: { target_assessment_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
