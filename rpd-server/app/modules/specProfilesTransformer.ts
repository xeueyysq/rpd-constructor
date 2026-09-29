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

type RawSpecProfile = { specialisation?: { code?: string; name?: string }; profiles?: { name?: string; chair?: { name?: string } }[] };

const merge1cIntoReferenceTree = (raw1c: unknown) => {
  const referenceTree = loadReferenceTree();
  const indexes = buildReferenceIndexes(referenceTree);
  const tree = deepClone(referenceTree);
  const items: unknown[] = Array.isArray(raw1c) ? raw1c : [];

  for (const item of items) {
    const entry = item && typeof item === "object" ? item as RawSpecProfile : null;
    const specialisation = entry?.specialisation;
    const profiles = Array.isArray(entry?.profiles) ? entry.profiles : [];

    if (!specialisation?.code) {
      continue;
    }

    const level = resolveCanonicalLevel(specialisation.code);
    if (!level) {
      continue;
    }

    for (const profile of profiles) {
      const profileName = profile?.name;
      const institute = resolveCanonicalInstitute(profile?.chair?.name, indexes);

      if (!institute) {
        continue;
      }

      const direction = resolveCanonicalDirection(
        specialisation.code,
        specialisation.name,
        institute,
        level,
        indexes
      );

      if (!direction) {
        continue;
      }

      const profileKey = resolveCanonicalProfile(
        profileName,
        direction,
        indexes
      );

      if (!profileKey) {
        continue;
      }

      setLeaf(
        tree,
        [institute, level, direction, profileKey, resolveCanonicalForm()],
        buildYearLeaves()
      );
    }
  }

  return tree;
};

export {
  merge1cIntoReferenceTree,
  hashPayload,
};
