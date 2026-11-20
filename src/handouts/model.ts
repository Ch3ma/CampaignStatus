import type { Status } from '../domain';

export const relationSlots = ['operation', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6'] as const;
export const relationKinds = ['operations', 'handouts', 'dossiers', 'personnel', 'clues'] as const;
export type RelationKind = typeof relationKinds[number];
export type Relation = { kind: RelationKind; targetId: string };
export type LinkedRecord = Relation & { title: string };
export type HandoutMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';
export type HandoutFields = {
  title: string;
  category: string;
  summary: string;
  narrativeDate: string;
  tags: string;
  classification: string;
  alt: string;
  downloadAllowed: boolean;
};
export type Handout = HandoutFields & {
  id: string;
  mime: HandoutMime;
  byteLength: number;
  status: Status;
  version: string;
};
export type Provenance = {
  document: string;
  page: string;
  section: string;
  adaptationNotes: string;
  supportingPages: string;
  references: Relation[];
};

export const relationLabels: Record<RelationKind, string> = {
  operations: 'Operación', handouts: 'Handout', dossiers: 'Expediente',
  personnel: 'Personal', clues: 'Evidencia',
};
export const relationRoutes: Record<Exclude<RelationKind, 'operations'>, string> = {
  handouts: '/handouts', dossiers: '/expedientes', personnel: '/personal', clues: '/evidencias',
};

const fileExtensions: Record<HandoutMime, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf',
};

export function clampZoom(zoom: number) {
  return Math.min(250, Math.max(50, zoom));
}

export function handoutDownloadName(id: string, mime: HandoutMime) {
  return `handout-${id}.${fileExtensions[mime]}`;
}

export function fileMatches(bytes: Uint8Array, mime: HandoutMime) {
  const starts = (pattern: number[], offset = 0) => pattern.every((byte, index) => bytes[offset + index] === byte);
  if (mime === 'application/pdf') return starts([37, 80, 68, 70, 45]);
  if (mime === 'image/png') return starts([137, 80, 78, 71, 13, 10, 26, 10]);
  if (mime === 'image/jpeg') return starts([255, 216, 255]);
  return mime === 'image/webp' && starts([82, 73, 70, 70]) && starts([87, 69, 66, 80, 86, 80, 56], 8);
}

export function clampPage(page: number, count: number) {
  return Math.min(count, Math.max(1, page));
}

export function playerCanSeeTarget(kind: RelationKind, data: { status?: unknown; audience?: unknown }) {
  return data.status === 'published' && (kind === 'handouts' || data.audience === 'cell');
}
