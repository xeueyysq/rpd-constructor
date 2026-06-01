const {
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
} = require("./specProfilesMapping");

const merge1cIntoReferenceTree = (raw1c) => {
  const referenceTree = loadReferenceTree();
  const indexes = buildReferenceIndexes(referenceTree);
  const tree = deepClone(referenceTree);
  const items = Array.isArray(raw1c) ? raw1c : [];
  let skippedProfiles = 0;

  for (const item of items) {
    const specialisation = item?.specialisation;
    const profiles = Array.isArray(item?.profiles) ? item.profiles : [];

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
        skippedProfiles += 1;
        continue;
      }

      setLeaf(
        tree,
        [institute, level, direction, profileKey, resolveCanonicalForm()],
        buildYearLeaves()
      );
    }
  }

  if (skippedProfiles > 0) {
    console.log(
      `specProfiles: пропущено профилей без канонического имени — ${skippedProfiles}`
    );
  }

  return tree;
};

module.exports = {
  merge1cIntoReferenceTree,
  hashPayload,
};
