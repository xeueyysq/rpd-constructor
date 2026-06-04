const { resolveZetFromStudyLoad } = require("./disciplineScope");
const { placeFromRecordType } = require("./disciplineRecordType");

const normalizeDisciplineFrom1c = (disc) => {
  const {
    discipline = "",
    semester = null,
    division = "",
    teachers = [],
    zets = null,
    record_type = "",
    study_load = {},
    control_load = {},
  } = disc || {};

  const normalizedSemester = Number(semester);
  const normalizedZets = Number(zets);
  const normalizedTeachers = Array.isArray(teachers)
    ? teachers.filter(
        (teacher) => typeof teacher === "string" && teacher.trim()
      )
    : typeof teachers === "string" && teachers.trim()
      ? [teachers.trim()]
      : [];
  const normalizedStudyLoad =
    study_load && typeof study_load === "object" ? study_load : {};
  const resolvedZet = resolveZetFromStudyLoad(
    normalizedStudyLoad,
    normalizedZets
  );
  const normalizedControlLoad =
    control_load &&
    typeof control_load === "object" &&
    !Array.isArray(control_load)
      ? control_load
      : {};
  const normalizedRecordType =
    typeof record_type === "string" ? record_type.trim() : "";
  const normalizedDiscipline =
    typeof discipline === "string" ? discipline.trim() : "";

  return {
    department: typeof division === "string" ? division : "",
    discipline: normalizedDiscipline,
    teachers: normalizedTeachers,
    zet: resolvedZet,
    place: placeFromRecordType(normalizedRecordType),
    record_type: normalizedRecordType,
    study_load: normalizedStudyLoad,
    control_load: normalizedControlLoad,
    semester: Number.isFinite(normalizedSemester) ? normalizedSemester : null,
  };
};

module.exports = { normalizeDisciplineFrom1c };
