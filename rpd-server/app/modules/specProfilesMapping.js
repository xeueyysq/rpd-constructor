const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const process = require("process");

const DEFAULT_FORM = "Очная";
const REFERENCE_PATH = path.join(process.cwd(), "app/data/json_profiles.json");
const YEAR_SLOTS_COUNT = 5;

const LEVEL_BY_SEGMENT = {
  "03": "Бакалавриат",
  "3": "Бакалавриат",
  "04": "Магистратура",
  "4": "Магистратура",
  "05": "Специалитет",
  "5": "Специалитет",
  "06": "Специалитет",
  "6": "Специалитет",
  "07": "Аспирантура",
  "7": "Аспирантура",
};

const normalizeWhitespace = (value) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

const normalizeName = (value) => normalizeWhitespace(value).toLowerCase();

const normalizeCode = (code) => normalizeWhitespace(code).split(/\s+/)[0] || "";

const pathKey = (institute, level) => `${institute}\u0000${level}`;

const isYearLeaves = (node) => {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return false;
  }

  const keys = Object.keys(node);
  if (!keys.length) {
    return false;
  }

  return keys.every((key) => {
    const numericKey = Number(key);
    return Number.isInteger(numericKey) && typeof node[key] === "number";
  });
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const stableSerialize = (value) => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
    .join(",")}}`;
};

const loadReferenceTree = () => {
  const raw = fs.readFileSync(REFERENCE_PATH, "utf8");
  return JSON.parse(raw);
};

const buildYearLeaves = () => {
  const currentYear = new Date().getFullYear();
  const leaves = {};

  for (let index = 0; index < YEAR_SLOTS_COUNT; index += 1) {
    leaves[String(index)] = currentYear + 1 - index;
  }

  return leaves;
};

const buildReferenceIndexes = (referenceTree) => {
  const institutes = new Set(Object.keys(referenceTree));
  const levels = new Set();
  const forms = new Set();
  const directionExact = new Set();
  const profileExact = new Set();
  const directionByPath = new Map();
  const profileByDirection = new Map();

  for (const [institute, levelNodes] of Object.entries(referenceTree)) {
    if (!levelNodes || typeof levelNodes !== "object") {
      continue;
    }

    for (const [level, directionNodes] of Object.entries(levelNodes)) {
      levels.add(level);

      if (!directionNodes || typeof directionNodes !== "object") {
        continue;
      }

      const directionsForPath =
        directionByPath.get(pathKey(institute, level)) || new Map();

      for (const [directionKey, profileNodes] of Object.entries(
        directionNodes
      )) {
        directionExact.add(directionKey);
        const code = normalizeCode(directionKey);
        const existing = directionsForPath.get(code) || [];
        existing.push(directionKey);
        directionsForPath.set(code, existing);

        const profilesForDirection =
          profileByDirection.get(directionKey) || new Map();

        if (!profileNodes || typeof profileNodes !== "object") {
          profileByDirection.set(directionKey, profilesForDirection);
          continue;
        }

        for (const [profileKey, formNodes] of Object.entries(profileNodes)) {
          profileExact.add(profileKey);
          profilesForDirection.set(normalizeName(profileKey), profileKey);

          if (!formNodes || typeof formNodes !== "object") {
            continue;
          }

          for (const formKey of Object.keys(formNodes)) {
            forms.add(formKey);
          }
        }

        profileByDirection.set(directionKey, profilesForDirection);
      }

      directionByPath.set(pathKey(institute, level), directionsForPath);
    }
  }

  return {
    institutes,
    levels,
    forms,
    directionExact,
    profileExact,
    directionByPath,
    profileByDirection,
  };
};

const resolveCanonicalInstitute = (chairName, indexes) => {
  const trimmed = normalizeWhitespace(chairName);
  if (!trimmed || !indexes.institutes.has(trimmed)) {
    return null;
  }

  return trimmed;
};

const resolveCanonicalLevel = (code) => {
  const segments = normalizeWhitespace(code).split(".");
  if (segments.length < 2) {
    return null;
  }

  const segment = segments[1];
  return LEVEL_BY_SEGMENT[segment] ?? LEVEL_BY_SEGMENT[segment.replace(/^0+/, "")] ?? null;
};

const directionNameFromKey = (directionKey, code) => {
  const prefix = `${code} `;
  if (directionKey.startsWith(prefix)) {
    return directionKey.slice(prefix.length);
  }

  return directionKey;
};

const resolveCanonicalDirection = (code, name, institute, level, indexes) => {
  const normalizedCode = normalizeCode(code);
  const normalizedName = normalizeName(name);
  const candidate = normalizeWhitespace(`${code} ${name}`);

  if (!candidate) {
    return null;
  }

  if (indexes.directionExact.has(candidate)) {
    return candidate;
  }

  const directionsForPath = indexes.directionByPath.get(pathKey(institute, level));
  if (!directionsForPath) {
    return null;
  }

  const matches = directionsForPath.get(normalizedCode) || [];
  if (!matches.length) {
    return candidate;
  }

  if (matches.length === 1) {
    return matches[0];
  }

  const matchedByName = matches.filter((directionKey) => {
    const directionName = directionNameFromKey(directionKey, normalizedCode);
    return normalizeName(directionName) === normalizedName;
  });

  if (matchedByName.length === 1) {
    return matchedByName[0];
  }

  return candidate;
};

const resolveCanonicalProfile = (profileName, canonicalDirection, indexes) => {
  const trimmed = normalizeWhitespace(profileName);
  if (!trimmed) {
    return null;
  }

  const profilesForDirection = indexes.profileByDirection.get(canonicalDirection);
  if (!profilesForDirection) {
    return trimmed;
  }

  if (profilesForDirection.has(normalizeName(trimmed))) {
    return profilesForDirection.get(normalizeName(trimmed));
  }

  for (const canonicalProfile of profilesForDirection.values()) {
    if (canonicalProfile === trimmed) {
      return canonicalProfile;
    }
  }

  return trimmed;
};

const resolveCanonicalForm = () => DEFAULT_FORM;

const mapApiDataFor1c = (apiData) => {
  const normalizedYear = Number(apiData.year);

  return {
    year: Number.isFinite(normalizedYear) ? normalizedYear : apiData.year,
    education_level: apiData.educationLevel,
    education_form: apiData.educationForm,
    profile: apiData.profile,
    direction: apiData.direction,
  };
};

const hashPayload = (payload) =>
  crypto.createHash("sha256").update(stableSerialize(payload)).digest("hex");

const setLeaf = (tree, pathSegments, leafValue) => {
  let current = tree;

  for (let index = 0; index < pathSegments.length - 1; index += 1) {
    const segment = pathSegments[index];
    if (!current[segment] || typeof current[segment] !== "object") {
      current[segment] = {};
    }
    current = current[segment];
  }

  current[pathSegments[pathSegments.length - 1]] = leafValue;
};

module.exports = {
  DEFAULT_FORM,
  buildReferenceIndexes,
  buildYearLeaves,
  deepClone,
  hashPayload,
  isYearLeaves,
  loadReferenceTree,
  mapApiDataFor1c,
  normalizeCode,
  normalizeName,
  resolveCanonicalDirection,
  resolveCanonicalForm,
  resolveCanonicalInstitute,
  resolveCanonicalLevel,
  resolveCanonicalProfile,
  setLeaf,
  stableSerialize,
};
