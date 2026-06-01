import { OptionType } from "./SelectorTypes";
import { SpecProfilesTree } from "./types";

const YEARS_COUNT = 5;

export const getFacultyOptions = (tree: SpecProfilesTree | undefined): OptionType[] => {
  if (!tree) {
    return [];
  }

  return Object.keys(tree).map((key) => ({ label: key, value: key }));
};

export const getNestedOptions = (
  tree: SpecProfilesTree | undefined,
  selectorPath: string[],
  indicator?: string
): OptionType[] => {
  if (indicator === "lastChild") {
    const currentYear = new Date().getFullYear();

    return Array.from({ length: YEARS_COUNT }, (_, index) => {
      const year = currentYear + 1 - index;
      return { label: String(year), value: String(year) };
    });
  }

  if (!tree) {
    return [];
  }

  let currentNode: SpecProfilesTree | number = tree;

  for (const segment of selectorPath) {
    if (typeof currentNode !== "object" || currentNode === null) {
      return [];
    }

    currentNode = currentNode[segment] as SpecProfilesTree | number;

    if (currentNode === undefined) {
      return [];
    }
  }

  if (typeof currentNode !== "object" || currentNode === null) {
    return [];
  }

  return Object.keys(currentNode).map((key) => ({
    label: key,
    value: key,
  }));
};
