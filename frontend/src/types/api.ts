export interface RoutineVersion {
  id: number;
  name: string;
  source_filename: string;
  semester: string | null;
  created_at: string;
  pages_processed: number;
  record_count: number;
  warning_count: number;
  repair_count: number;
}

export interface VersionsResponse {
  versions: RoutineVersion[];
}

export interface OptionsResponse {
  version_id: number;
  batches: string[];
  sections: string[];
  courses: string[];
  teachers: string[];
  rooms: string[];
  groups: string[];
  batch_sections: { batch: string; section: string }[];
}

export interface ClassRecord {
  id: number;
  record_type: 'original' | 'edited' | 'moved' | 'hidden' | 'manually_added';
  page: number;
  day: string;
  start_time: string;
  end_time: string;
  room: string;
  course_code: string;
  group_code: string;
  batch: string;
  section: string;
  subgroup: string | null;
  special_group: string | null;
  teacher: string | null;
}

export interface ClassesResponse {
  version_id: number;
  count: number;
  classes: ClassRecord[];
}

export interface SearchResponse extends ClassesResponse {
  query: string;
}

export interface UploadResponse {
  message: string;
  version_id: number;
  semester: string | null;
  pages_processed: number;
  record_count: number;
  warning_count: number;
  repair_count: number;
  repairs: any[];
  warnings?: any[];
  unresolved?: any[];
  status?: string;
  session_id?: string;
  filename?: string;
  name?: string;
}

export interface OverrideRequest {
  target_class_id?: number;
  override_type: 'edited' | 'moved' | 'hidden' | 'manually_added';
  day?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
  course_code?: string;
  group_code?: string;
  batch?: string;
  section?: string;
  subgroup?: string | null;
  special_group?: string | null;
  teacher?: string | null;
}
