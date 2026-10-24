const state = {
  started: false,
  suspended: true,
  tickMs: 60_000,
  fireAlarmMs: 1_800_000,
  running: false,
};

/** API v3.0 does not provide simulator state or device/alarm mutation endpoints. */
export async function startSimulator() {}

export function stopSimulator() {}

export async function suspendSimulator() {}

export async function resumeSimulator() {}

export async function setSimulatorInterval(_ms: number) {}

export function getSimulatorState() {
  return { ...state };
}

export async function getDbSimulatorState() {
  return getSimulatorState();
}

export async function triggerFireInBuilding(_buildingId: string): Promise<{
  success: boolean;
  message: string;
  deviceCode?: string;
  floorLabel?: string;
}> {
  return {
    success: false,
    message: 'API v3.0 does not provide a simulator or device-status mutation endpoint.',
  };
}
