import {
  buildReferenceIndexes,
  buildYearLeaves,
  deepClone,
  hashPayload,
  loadReferenceTree,
  resolveCanonicalDirection,
  resolveCanonicalForm,
  resolveCanonicalInstitute,
  resolveCanonicalLevel,
  resolveCanonicalProfile,
  setLeaf,
} from "./specProfilesMapping.ts";
import { resolveDepartmentInstitute } from "./specProfilesInstitutes.ts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const nonEmptyString = (value: unknown) => typeof value === "string" ? value.trim() : "";

type SpecProfile = {
  code: string;
  directionName: string;
  level: string;
  profileName: string;
  chairName: string;
  institute: string | null;
  identity: string | null;
};

const merge1cIntoReferenceTree = (raw1c: unknown) => {
  const referenceTree = loadReferenceTree();
  const indexes = buildReferenceIndexes(referenceTree);
  const tree = deepClone(referenceTree);
  const items: unknown[] = Array.isArray(raw1c) ? raw1c : [];
  const profiles: SpecProfile[] = [];

  for (const item of items) {
    if (!isRecord(item) || !isRecord(item.specialisation) || !Array.isArray(item.profiles)) {
      continue;
    }

    const specialisation = item.specialisation;
    const code = nonEmptyString(specialisation.code);
    const directionName = nonEmptyString(specialisation.name);
    if (!/^\d+(?:\.\d+)+$/.test(code) || !directionName) {
      continue;
    }

    const level = resolveCanonicalLevel(code);
    if (!level) continue;

    const specialisationId = nonEmptyString(specialisation.id);
    for (const profile of item.profiles) {
      if (!isRecord(profile) || !isRecord(profile.chair)) continue;
      const profileName = nonEmptyString(profile.name);
      const chairName = nonEmptyString(profile.chair.name);
      if (!profileName || !chairName) continue;

      const profileId = nonEmptyString(profile.id);
      profiles.push({
        code,
        directionName,
        level,
        profileName,
        chairName,
        institute: resolveCanonicalInstitute(chairName, indexes),
        identity: specialisationId && profileId ? JSON.stringify([specialisationId, profileId, code]) : null,
      });
    }
  }

  // Прямые привязки относятся только к этому профилю, а не ко всей кафедре.
  const explicitlyAssigned = new Set(profiles.filter(profile => profile.institute && profile.identity).map(profile => profile.identity));

  for (const profile of profiles) {
    if (!profile.institute && profile.identity && explicitlyAssigned.has(profile.identity)) continue;

    const institute = profile.institute ?? resolveCanonicalInstitute(resolveDepartmentInstitute(profile.chairName), indexes);
    if (!institute) continue;

    const direction = resolveCanonicalDirection(profile.code, profile.directionName, institute, profile.level, indexes);
    if (!direction) continue;

    const profileKey = resolveCanonicalProfile(profile.profileName, direction, indexes);
    if (!profileKey) continue;

    setLeaf(
      tree,
      [institute, profile.level, direction, profileKey, resolveCanonicalForm()],
      buildYearLeaves()
    );
  }

  return tree;
};

export {
  merge1cIntoReferenceTree,
  hashPayload,
};
