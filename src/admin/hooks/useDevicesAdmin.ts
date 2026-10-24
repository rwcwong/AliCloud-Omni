import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../../lib/apiCompat';
import { ControlRoom, Device, DeviceType, Floor } from '../../types';

export type DeviceWithRelations = Omit<Device, 'device_types' | 'floors' | 'control_rooms'> & {
  device_types: DeviceType;
  floors: Floor;
  control_rooms?: ControlRoom | null;
};

export function useDevicesAdmin() {
  const [devices, setDevices] = useState<DeviceWithRelations[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([]);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    const [devRes, dtRes] = await Promise.all([
      apiClient
        .from('admin_devices')
        .select(`*, device_types(*), floors(*, buildings(*, sites(*))), control_rooms(id, name)`)
        .order('code', { ascending: true }),
      apiClient.from('admin_device_types').select('*').order('category').order('name_en'),
    ]);
    if (currentRequest !== requestId.current) return;
    setDevices((devRes.data as DeviceWithRelations[]) ?? []);
    setDeviceTypes((dtRes.data as DeviceType[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    window.addEventListener('omnios:data-changed', refresh);
    return () => {
      requestId.current += 1;
      window.removeEventListener('omnios:data-changed', refresh);
    };
  }, [load]);

  async function createDevice(payload: {
    floor_id: string;
    device_type_id: string;
    code: string;
    label: string;
    serial_number?: string;
    notes?: string;
    position_x?: number | null;
    position_y?: number | null;
    control_room_id?: string | null;
  }) {
    const { data, error } = await apiClient
      .from('admin_devices')
      .insert(payload)
      .select()
      .maybeSingle();
    if (!error) await load();
    return { data, error };
  }

  async function updateDevice(id: string, payload: Partial<Device>) {
    const { error } = await apiClient.from('admin_devices').update(payload).eq('id', id);
    if (!error) await load();
    return { error };
  }

  async function toggleActive(id: string, is_active: boolean) {
    const { error } = await apiClient.from('admin_devices').update({ is_active }).eq('id', id);
    if (!error) await load();
    return { error };
  }

  async function deleteDevice(id: string) {
    const { error } = await apiClient.from('admin_devices').delete().eq('id', id);
    if (!error) await load();
    return { error };
  }

  async function createDeviceType(payload: Omit<DeviceType, 'id'>) {
    const { data, error } = await apiClient
      .from('admin_device_types')
      .insert(payload)
      .select()
      .maybeSingle();
    if (!error) await load();
    return { data, error };
  }

  async function updateDeviceType(id: string, payload: Partial<DeviceType>) {
    const { error } = await apiClient.from('admin_device_types').update(payload).eq('id', id);
    if (!error) await load();
    return { error };
  }

  async function deleteDeviceType(id: string) {
    const { error } = await apiClient.from('admin_device_types').delete().eq('id', id);
    if (!error) await load();
    return { error };
  }

  return { devices, deviceTypes, loading, reload: load, createDevice, updateDevice, toggleActive, deleteDevice, createDeviceType, updateDeviceType, deleteDeviceType };
}
