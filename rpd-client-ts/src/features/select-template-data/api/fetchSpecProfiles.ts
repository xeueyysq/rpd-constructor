import { axiosBase } from "@shared/api";
import { SpecProfilesResponse } from "../model/types";

export const fetchSpecProfiles = async (): Promise<SpecProfilesResponse> => {
  const { data } = await axiosBase.get<SpecProfilesResponse>("spec-profiles");
  return data;
};
