export const cellId = 'cell-a';
export const demoProject = 'demo-black-archive';
export const collections = ['operations', 'dossiers', 'personnel', 'clues', 'messages'] as const;
export const statuses = ['draft', 'review', 'published', 'archived'] as const;

export type Collection = typeof collections[number];
export type Status = typeof statuses[number];
export type Role = 'handler' | 'agent';
export type Membership = { role: Role; alias: string };

export type RecordFields = {
  title: string;
  category: string;
  summary: string;
  body: string;
  tags: string;
  connections: string;
  photo: string;
  stage: string;
  status: Status;
  audience: 'cell' | 'direct';
  recipientUid: string;
};

export type ArchiveRecord = RecordFields & {
  id: string;
  publishedAt: number | null;
  publishedBy: string;
  version: string;
};

export const collectionLabels: Record<Collection, string> = {
  operations: 'Operaciones',
  dossiers: 'Expedientes',
  personnel: 'Personal',
  clues: 'Evidencias',
  messages: 'Comunicaciones',
};

export const statusLabels: Record<Status, string> = {
  draft: 'Borrador',
  review: 'En revisión',
  published: 'Publicado',
  archived: 'Archivado',
};

export const emptyRecord: RecordFields = {
  title: '', category: '', summary: '', body: '', tags: '', connections: '', photo: '',
  stage: '', status: 'draft', audience: 'cell', recipientUid: '',
};

export function accessState(authReady: boolean, uid: string | null, membership: Membership | null) {
  if (!authReady) return 'loading';
  if (!uid) return 'login';
  return membership ? 'allowed' : 'denied';
}

export function splitTags(tags: string) {
  return [...new Set(tags.split(',').map((tag) => tag.trim()).filter(Boolean))];
}

export function safePhoto(photo: string) {
  return photo.length <= 180000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)
    ? photo : '';
}

export function filterDossiers(records: ArchiveRecord[], search: string, tag: string) {
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const terms = normalize(search.trim()).split(/\s+/).filter(Boolean);
  return records.filter((record) => {
    const haystack = normalize([record.title, record.summary, record.category, record.tags, record.body].join(' '));
    return (!tag || splitTags(record.tags).includes(tag)) && terms.every((term) => haystack.includes(term));
  });
}

export function dateLabel(epoch: number | null) {
  return epoch === null ? 'Sin fecha de publicación' : new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(epoch);
}
