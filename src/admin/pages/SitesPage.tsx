import { useState } from 'react';
import { Briefcase, Landmark, Building, DoorOpen, Layers } from 'lucide-react';
import { ProjectTab } from './ProjectTab';
import { SitesTab } from './SitesTab';
import { BuildingTab } from './BuildingTab';
import { FloorTab } from './FloorTab';
import { ControlRoomTab } from './ControlRoomTab';

type Tab = 'project' | 'sites' | 'building' | 'floor' | 'control_room';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'project', label: 'Project', icon: Briefcase },
  { id: 'sites',   label: 'Property', icon: Landmark },
  { id: 'building', label: 'Building', icon: Building },
  { id: 'floor', label: 'Floors', icon: Layers },
  { id: 'control_room', label: 'Control Room', icon: DoorOpen },
];

export function SitesPage() {
  const [tab, setTab] = useState<Tab>('project');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 border-b border-cyan-300/10">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all relative ${
              tab === id
                ? 'text-cyan-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon size={15} />
            {label}
            {tab === id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {tab === 'project'  && <ProjectTab />}
      {tab === 'sites'    && <SitesTab />}
      {tab === 'building' && <BuildingTab />}
      {tab === 'floor' && <FloorTab />}
      {tab === 'control_room' && <ControlRoomTab />}
    </div>
  );
}
