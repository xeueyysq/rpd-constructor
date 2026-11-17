const placeFromRecordType = (recordType: unknown) => {
  if (typeof recordType !== "string") return "";
  const normalized = recordType.trim();
  if (!normalized) return "";
  const marker = normalized.split(".")[1]?.trim()?.charAt(0)?.toUpperCase();
  if (marker === "О" || marker === "O") {
    return "обязательной части";
  }
  if (marker === "В" || marker === "B") {
    return "части, формируемой участниками образовательных отношений";
  }
  return "";
};

const normalizePlace = (place: unknown) => {
  if (typeof place !== "string") return "";
  const value = place.trim().replace(/\s+/g, " ");
  if (!value) return "";
  const fromCode = placeFromRecordType(value);
  if (fromCode) return fromCode;
  if (/^К\.М(?:\.|$)/i.test(value)) return "";
  const normalized = value.toLowerCase().replaceAll("ё", "е");
  if (normalized === "обязательная часть" || normalized === "обязательной части") return "обязательной части";
  if (normalized === "часть, формируемая участниками образовательных отношений"
    || normalized === "части, формируемой участниками образовательных отношений") {
    return "части, формируемой участниками образовательных отношений";
  }
  return value;
};

export { placeFromRecordType, normalizePlace };
