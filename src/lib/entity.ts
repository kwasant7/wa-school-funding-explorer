/*
  What kind of public school entity a record is. Kept apart from lib/data so
  the brief can use it without pulling history.json into its bundle.

  Charter schools stand their authorizer in place of an ESD; state-tribal
  education compact schools carry no ESD at all. Both are identified by data
  rather than a hand-kept list, so the next one to open is classified without
  anyone remembering to add it.
*/

export function isCharter(entity: { esd: string }): boolean {
  return entity.esd.includes('Charter');
}

export function isCompact(entity: { esd: string }): boolean {
  return entity.esd.trim() === '';
}

/** A school district proper - neither a charter nor a tribal compact school. */
export function isSchoolDistrict(entity: { esd: string }): boolean {
  return !isCharter(entity) && !isCompact(entity);
}
