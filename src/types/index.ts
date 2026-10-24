export type DeviceStatus =
  | 'Normal' | 'Alarm' | 'Fault' | 'Offline' | 'Testing' | 'Acknowledged'
  | 'Off' | 'On' | 'Running' | 'Power On' | 'Activated'
  | 'Open' | 'Closed' | 'Low Level' | 'High Level' | 'Low Pressure'
  | 'Auto Mode' | 'Manual Mode' | 'MCCB Off'
  | 'Panel Fire' | 'Panel Fault' | 'Homed' | '';

export type AlarmSeverity = 'critical' | 'alarm' | 'fault' | 'high' | 'medium' | 'low';
export type AlarmStatus = 'active' | 'acknowledged' | 'dispatched' | 'resolved' | 'false_alarm';
export type MaintenanceStatus = 'pending' | 'in_progress' | 'resolved' | 'ignored';
export type UserRole = 'system_admin' | 'admin' | 'executive' | 'property_manager' | 'guard' | 'technician' | 'readonly' | 'no_access';

export interface Role {
  id: string;
  key: string;
  label: string;
  label_zh: string | null;
  description: string | null;
  color_class: string | null;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeviceType {
  id: string;
  api_id?: number;
  code: string;
  category: 'detection' | 'pump' | 'water' | 'ventilation' | 'power_interlocking' | '';
  name_en: string;
  name_zh: string;
  name_zh_tw: string;
  priority: 'critical' | 'high' | 'medium' | 'low' | '';
  possible_states: string[];
  has_numeric_value: boolean | null;
  unit: string | null;
}

export interface Device {
  id: string;
  floor_id: string;
  device_type_id: string;
  code: string;
  label: string;
  position_x: number | null;
  position_y: number | null;
  status: DeviceStatus;
  current_value: number | null;
  last_seen_at: string;
  is_active?: boolean;
  control_room_id: string | null;
  serial_number: string;
  brand: string;
  notes: string;
  installed_at?: string;
  created_at?: string;
  device_types?: DeviceType;
  floors?: Floor;
  control_rooms?: ControlRoom;
  terminal_type?: string;
  battery_value?: number | null;
  signal_power?: number | null;
  alarm_min?: number | null;
  alarm_max?: number | null;
  alarm_dynamic?: number | null;
  reason?: string | null;
  api_status?: 0 | 1 | 2 | 3;
  project_code?: string;
  site_code?: string;
  building_name?: string;
  floor_name?: string;
}

export interface Floor {
  id: string;
  api_id?: number;
  building_id: string;
  floor_number: number;
  floor_label: string;
  image_url?: string | null;
  buildings?: Building;
  project_code?: string;
  site_code?: string;
  building_name?: string;
  alarm_count?: number;
  fault_count?: number;
  offline_count?: number;
}

export interface Building {
  id: string;
  api_id?: number;
  site_id: string;
  name: string;
  name_zh: string;
  total_floors: number;
  basement_floors: number;
  image_url?: string | null;
  sites?: Site;
  project_code?: string;
  site_code?: string;
  total_devices?: number;
  floor_details?: import('../api/types').ApiFloorDetail[];
}

export type FloorPlanImageType = 'floor_plan' | 'building_photo' | 'site_map' | 'render';
export type FloorPlanFileFormat = 'jpg' | 'jpeg' | 'png' | 'svg' | 'pdf' | 'webp' | 'cad';

export interface FloorPlanImage {
  id: string;
  floor_id: string | null;
  building_id: string | null;
  image_url: string;
  image_type: FloorPlanImageType;
  file_format: FloorPlanFileFormat;
  version: number | null;
  is_active: boolean;
  label: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  api_id?: number;
  name: string;
  name_zh: string;
  description: string;
  created_at?: string;
  updated_at?: string;
  project_code?: string;
  project_name?: string;
  project_name_cn?: string;
  project_name_zh?: string;
  site_count?: number;
  building_count?: number;
  device_count?: number;
  alarm_count?: number;
  online_count?: number;
  fault_count?: number;
  health_score?: number | null;
}

export interface Site {
  id: string;
  api_id?: number;
  project_id: string | null;
  name: string;
  name_zh: string;
  address: string;
  city: string;
  contact_email: string;
  contact_phone: string;
  latitude: number | null;
  longitude: number | null;
  created_at?: string;
  projects?: Project;
  site_code?: string;
  site_name?: string;
  building_count?: number;
  total_devices?: number;
  online_count?: number;
  alarm_count?: number;
  fault_count?: number;
  status?: string;
}

export interface AlarmEvent {
  id: string;
  device_id: string;
  alarm_type: string;
  severity: AlarmSeverity;
  status: AlarmStatus;
  description: string;
  acknowledged_by: string | null;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  dispatched_to: string | null;
  dispatcher_name: string | null;
  dispatcher_contact: string | null;
  dispatched_at: string | null;
  resolved_by: string | null;
  resolver_name: string | null;
  resolved_at: string | null;
  triggered_at: string;
  devices?: Device & { device_types?: DeviceType; floors?: Floor & { buildings?: Building & { sites?: Site } } };
  source_severity?: string;
  project_code?: string;
  site_code?: string;
  building_name?: string;
  floor_name?: string;
  floor_plan_url?: string | null;
}

export interface MaintenancePrediction {
  id: string;
  device_id: string;
  prediction_type: string;
  fault_probability: number;
  predicted_failure_date: string | null;
  recommendation: string;
  recommendation_zh: string;
  status: MaintenanceStatus;
  confidence_score: number | null;
  triggered_by_rule_id: string | null;
  created_at: string;
  devices?: Device & { device_types?: DeviceType; floors?: Floor & { buildings?: Building } };
  maintenance_rules?: MaintenanceRule;
  project_code?: string;
  site_name?: string;
  building_name?: string;
  floor_name?: string;
}

/** v3 defines this as a string, not an enum. Preserve existing backend model identifiers. */
export type MaintenanceRuleType = string;

export interface MaintenanceRule {
  id: string;
  name: string;
  name_zh: string;
  rule_type: MaintenanceRuleType;
  device_category: string;
  threshold: number;
  time_window_hours: number;
  min_probability: number;
  recommendation: string;
  recommendation_zh: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ComplianceReport {
  id: string;
  site_id: string;
  report_type: string;
  title: string;
  period_start: string;
  period_end: string;
  status: 'draft' | 'pending_review' | 'approved' | 'submitted';
  pdf_url: string | null;
  created_at: string;
}

export interface DeviceSignal {
  deviceId: string;
  deviceCode: string;
  status: DeviceStatus;
  value: number | null | undefined;
  timestamp: string;
  reason?: string | null;
  batteryValue?: number | null;
  unit?: string | null;
}

export type Language = 'zh-TW' | 'zh-CN' | 'en';
export type Theme = 'dark' | 'light';
export type Scenario = 'wallscreen' | 'mobile' | 'admin' | 'omni' | 'omni_ipad' | 'system_management' | 'overview_3d' | 'building_dashboard' | 'block_dashboard';

export interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface UserSiteRole {
  id: string;
  user_id: string;
  site_id: string;
  role: UserRole;
  created_at: string;
  sites?: Site;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string;
  action: string;
  table_name: string;
  record_id: string | null;
  record_label: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export type ControlRoomType = 'pump' | 'ventilation' | 'elevator' | 'electrical';
export type ControlRoomStatus = 'active' | 'inactive' | 'maintenance' | 'decommissioned';

export interface ControlRoom {
  id: string;
  building_id: string;
  floor_id: string | null;
  room_type: ControlRoomType;
  name: string;
  name_zh: string;
  location_description: string;
  status: ControlRoomStatus;
  is_active: boolean;
  notes: string;
  created_at?: string;
  buildings?: Building;
}

export interface PendingRegistration {
  id: string;
  name: string;
  email: string;
  telephone: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_notes: string | null;
}
