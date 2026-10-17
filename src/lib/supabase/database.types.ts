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
          last_name: string;
          phone: string | null;
          employee_number: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role?: UserRole;
          first_name?: string;
          last_name?: string;
          phone?: string | null;
          employee_number?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          email?: string;
          role?: UserRole;
          first_name?: string;
          last_name?: string;
          phone?: string | null;
          employee_number?: string | null;
          is_active?: boolean;
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
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          address?: string | null;
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
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          start_time: string;
          end_time: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          start_time?: string;
          end_time?: string;
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
