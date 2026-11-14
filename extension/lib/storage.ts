// chrome.storage.local: the map and incidents. Nothing here ever leaves the device.
import type { Incident, MapEntry } from './types';

type Stored = { map: MapEntry[]; incidents: Incident[] };

async function read(): Promise<Stored> {
  const s = await chrome.storage.local.get(['map', 'incidents']);
  return { map: (s.map as MapEntry[]) ?? [], incidents: (s.incidents as Incident[]) ?? [] };
}

export async function getMap(): Promise<MapEntry[]> {
  return (await read()).map;
}

export async function saveMapEntry(entry: MapEntry): Promise<void> {
  const map = (await read()).map.filter((e) => e.domain !== entry.domain);
  await chrome.storage.local.set({ map: [...map, entry] });
}

export async function getIncidents(): Promise<Incident[]> {
  return (await read()).incidents;
}

export async function addIncident(incident: Incident): Promise<void> {
  const incidents = (await read()).incidents.filter((i) => i.target !== incident.target);
  await chrome.storage.local.set({ incidents: [...incidents, incident] });
}

export async function clearAll(): Promise<void> {
  await chrome.storage.local.set({ map: [], incidents: [] });
}

/** A company is affected when it, or one of its systems, is the target of an incident. */
export function affectedBy(entry: MapEntry, incidents: Incident[]): Incident | null {
  const names = [entry.company, ...entry.systems.map((s) => s.name)].map((n) => n.toLowerCase());
  return incidents.find((i) => names.includes(i.target.toLowerCase())) ?? null;
}
