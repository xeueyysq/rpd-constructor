const placeFromRecordType = (recordType) => {
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

module.exports = { placeFromRecordType };
