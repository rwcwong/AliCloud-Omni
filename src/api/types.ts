/** Wire contract: omini_os_api_interface_v3.0(1).md. */
export type ApiRole = 'admin' | 'executive' | 'officer';
export type ApiDeviceStatus = 0 | 1 | 2 | 3;
export type ApiCategory = 'Detection' | 'Pumps' | 'Water System' | 'Ventilation' | 'Power and Interlocking';
export type ApiAlarmStatus = 'active' | 'acknowledged' | 'dispatched' | 'resolved';
export type ApiPredictionStatus = 'pending' | 'in_progress' | 'resolved' | 'ignored';
export type TrendRange = '1h' | '24h' | '7d' | '1m';
export type StatisticsRange = '1d' | '7d' | '30d';

export interface ApiUserInfo {
  sub?: string; username: string; user_id?: number; real_name: string; role: ApiRole;
  project_code: string | null; project_name_zh?: string | null;
  site_code: string | null; site_name: string | null;
}
export interface LoginRequest { username: string; password: string }
export interface LoginResponse { access_token: string; token_type: string; user_info: ApiUserInfo }
export interface CreateUserRequest {
  username: string; password: string; real_name: string; role: ApiRole;
  project_code?: string; site_code?: string;
}
export interface CreateUserResponse { success: boolean; user_id: number; username: string }
export interface ApiManagedUser {
  user_id: number;
  username: string;
  real_name: string;
  role: ApiRole;
  project_code: string | null;
  project_name_zh: string | null;
  site_code: string | null;
  site_name_zh: string | null;
  created_at: string;
}
export interface ManagedUsersFilters {
  role?: ApiRole;
  project_code?: string;
  search?: string;
}
export interface DeleteUserResponse { success: boolean; deleted_user_id: number; username: string }
export interface DeviceStatusDistribution {
  total: number; online: number; normal?: number; alarm: number; fault: number; offline: number;
}
export interface LiveAlarmCounts { total: number; active: number; acknowledged: number; dispatched: number }
export interface PredictionCounts { all: number; pending: number; in_progress: number; resolved: number; ignored: number }
export interface ProjectSiteMarker {
  site_code: string; site_name: string; site_name_zh?: string;
  latitude: number | null; longitude: number | null;
  status?: string; alarm_count?: number; fault_count?: number;
}
export interface ProjectSummaryItem {
  project_code: string; project_name: string; project_name_zh: string; description?: string;
  site_count: number; building_count: number; device_count: number;
  online_count?: number; alarm_count: number; fault_count?: number;
  health_score?: number | null; sites: ProjectSiteMarker[];
}
export interface ProjectsSummaryResponse {
  device_status_distribution: DeviceStatusDistribution; live_alarms?: LiveAlarmCounts;
  predictive_maintenance?: { total: number; resolved: number; in_progress: number; pending: number; no_action: number };
  projects: ProjectSummaryItem[];
}
export interface SiteSummaryItem extends ProjectSiteMarker {
  id?: number; city?: string | null; address?: string | null;
  building_count: number; total_devices: number; online_count: number; fault_count?: number; alarm_count: number;
}
export interface ProjectSitesResponse {
  device_status_distribution: DeviceStatusDistribution; live_alarms?: LiveAlarmCounts; sites: SiteSummaryItem[];
}
export interface ApiFloorDetail {
  floor_name: string; floor_number: number; alarm_count: number; fault_count: number; offline_count: number;
}
export interface BuildingSummaryItem {
  building_name: string; building_name_zh?: string; total_devices: number; floors: string[];
  floor_details?: ApiFloorDetail[];
}
export interface SiteBuildingsResponse {
  device_status_distribution: DeviceStatusDistribution;
  trouble_by_category?: { category: string; alarm: number; fault: number; offline: number }[];
  buildings: BuildingSummaryItem[];
}
export interface ApiDevicePoint {
  device_id: string; label?: string; device_type_code?: string; category?: ApiCategory | string;
  terminal_type?: string | null;
  position_x: number | null; position_y: number | null; status: ApiDeviceStatus;
  current_value: number | null; unit: string | null; battery_value: number | null;
  signal_power: number | null; alarm_min: number | null; alarm_max: number | null; last_seen: string | null;
}
export interface BuildingDetailResponse {
  building_name: string; current_floor: string | null; trouble_floors_count?: number;
  floors: string[]; floor_details?: ApiFloorDetail[]; floor_plan_url?: string | null;
  device_status_distribution?: DeviceStatusDistribution; devices: ApiDevicePoint[];
}
export interface DeviceSnapshot extends ApiDevicePoint {
  project_code: string; project_name_zh?: string | null; site_code: string; site_name?: string | null;
  building_name: string; floor_name: string; alarm_dynamic: number | null; reason: string | null;
}
export interface SpatialFilters {
  project_code?: string; site_code?: string; building_name?: string; category?: string;
}
export interface SnapshotFilters { device_id: string }
export interface Paginated<T> { total: number; page: number; page_size: number; total_pages: number; items: T[] }
export interface AlarmFilters extends SpatialFilters {
  page?: number; page_size?: number; status?: ApiAlarmStatus | 'all'; floor_name?: string;
  sort_by?: 'time' | 'severity' | 'site';
}
export interface ApiAlarm {
  id: number; device_id: string; device_label: string; category: string; alarm_type: string;
  severity: 'Alarm' | 'Fault' | 'Critical'; status: ApiAlarmStatus; description: string;
  triggered_at: string; acknowledged_by: string | null; acknowledged_at: string | null;
  dispatched_to: string | null; dispatched_at: string | null; resolved_at: string | null;
  project_code: string; site_code: string; site_name: string; contact_phone?: string;
  building_name: string; floor_name: string; floor_plan_url?: string | null;
  position_x: number | null; position_y: number | null;
}
export type AlarmAction = { action: 'acknowledge' } | { action: 'dispatch'; dispatched_to: string };
export interface ApiPrediction {
  id: number; device_id: string; device_label: string; triggered_by_rule_id: number | null;
  prediction_type: string; fault_probability_pct?: number; fault_probability: number;
  predicted_failure_date: string | null; recommendation: string; recommendation_zh: string;
  status: ApiPredictionStatus; floor_name: string; building_name: string; site_name: string; project_code: string;
}
export interface PredictionsResponse { counts: PredictionCounts; items: ApiPrediction[] }
export interface PredictionFilters { status?: ApiPredictionStatus; rule_id?: number | string }
export interface TrendDevice { device_code: string; label: string; unit: string | null; tag_display: string }
export interface DeviceTrendsResponse {
  time_range: TrendRange;
  series: { device_code: string; label: string; unit: string | null; points: [string, number | null][] }[];
}
export interface AlarmStatisticsResponse {
  time_range: StatisticsRange;
  summary: { total_events: number; critical_events: number; alarm_events: number; fault_events: number };
  trend: { date: string; total: number; alarms: number; faults: number }[];
}
export interface StatisticsFilters extends SpatialFilters {
  time_range?: StatisticsRange; severity?: 'Alarm' | 'Fault' | 'Critical';
}
export interface AdminProject {
  project_id: number; project_code: string; project_name: string; project_name_zh: string;
  description: string; site_count?: number;
}
export interface AdminSite {
  site_id: number; project_code: string; project_name?: string; project_name_zh?: string;
  site_code: string; site_name: string; site_name_zh: string; city: string; address: string;
  latitude: number | null; longitude: number | null; contact_email: string; contact_phone: string;
  building_count?: number;
}
export interface AdminBuilding {
  building_id: number; project_code: string; project_name?: string; project_name_zh?: string;
  site_code: string; site_name?: string; site_name_zh?: string;
  building_name: string; building_name_zh: string; basement_floors: number; total_floors: number;
}
export interface AdminFloor {
  floor_id: number; project_code: string; project_name?: string; project_name_zh?: string;
  site_code: string; site_name?: string; site_name_zh?: string;
  building_name: string; building_name_zh?: string; floor_label: string; floor_number: number;
  floor_plan_url: string | null;
}
export interface AdminDevice {
  device_code: string; label: string; serial_number: string | null;
  position_x: number | null; position_y: number | null; notes: string | null;
  project_code: string; project_name?: string; project_name_zh?: string;
  site_code: string; site_name?: string; site_name_zh?: string;
  building_name: string; building_name_zh?: string; floor_label: string;
  device_type_code: string | null; type_name_en?: string; category?: string; status: ApiDeviceStatus;
}
export interface AdminDeviceType {
  type_id: number; code: string; category: string; name_en: string; name_zh: string; name_zh_tw?: string;
  priority: 'low' | 'medium' | 'high' | 'critical'; unit: string | null;
  has_numeric_value: boolean; possible_states: string[];
}
export interface AdminFsdCode {
  code_id: number; code: string; description_en: string; description_zh: string;
  frequency: 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual'; device_category: string;
  is_active: boolean; created_at: string; updated_at: string;
}
export interface AdminMaintenanceRule {
  rule_id: number; name: string; name_zh: string; rule_type: string; device_category: string;
  threshold: number; time_window_hours: number; min_probability: number;
  recommendation: string; recommendation_zh: string; is_active: boolean;
  created_at: string; updated_at: string;
}
export interface AdminResourceRows {
  projects: AdminProject; sites: AdminSite; buildings: AdminBuilding; floors: AdminFloor;
  devices: AdminDevice; 'device-types': AdminDeviceType; 'fsd-codes': AdminFsdCode;
  'maintenance-rules': AdminMaintenanceRule;
}
export type AdminResource = keyof AdminResourceRows;
export interface AdminFilters extends SpatialFilters {
  search?: string; floor_label?: string; status?: ApiDeviceStatus; page?: number; page_size?: number;
}
export interface MutationResponse {
  success: boolean; project_id?: number; site_id?: number; building_id?: number; floor_id?: number;
  type_id?: number; code_id?: number; rule_id?: number; project_code?: string; site_code?: string;
  building_name?: string; floor_label?: string; device_code?: string;
}
export interface IotStreamPayload {
  type?: 'device_status_change';
  data: {
    device_id: string; status: ApiDeviceStatus; current_value?: number | null; unit?: string | null;
    reason?: string | null; timestamp: string; battery_value?: number | null;
    project_code?: string; site_code?: string; building_name?: string; floor_name?: string;
  };
}
