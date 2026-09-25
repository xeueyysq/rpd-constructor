type FullName = {
  surname?: string | null;
  name?: string | null;
  patronymic?: string | null;
};

export function formatFullName(fullname: FullName | null | undefined): string {
  if (!fullname) return "";

  return [fullname.surname, fullname.name, fullname.patronymic]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}
