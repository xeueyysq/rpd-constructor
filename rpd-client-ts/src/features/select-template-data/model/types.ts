export interface SpecProfilesTree {
  [key: string]: SpecProfilesTree | number;
}

export type SpecProfilesSource = "1c" | "database" | "fallback" | "local";

export interface SpecProfilesResponse {
  tree: SpecProfilesTree;
  source: SpecProfilesSource;
}
