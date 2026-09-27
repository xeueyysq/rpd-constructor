import { axiosBase } from "@shared/api";
import type { User, UserPayload } from "../model/types";

export async function getUsers(): Promise<User[]> {
  const { data } = await axiosBase.get<User[]>("users");
  return data;
}

export async function createUser(payload: UserPayload): Promise<User> {
  const { data } = await axiosBase.post<User>("users", payload);
  return data;
}

export async function updateUser(
  id: number,
  payload: UserPayload
): Promise<User> {
  const { data } = await axiosBase.put<User>(`users/${id}`, payload);
  return data;
}

export async function setUsersActive(
  ids: number[],
  isActive: boolean
): Promise<{ updated: number }> {
  const { data } = await axiosBase.patch<{ updated: number }>("users", {
    ids,
    is_active: isActive,
  });
  return data;
}

export interface AssignableTeacher {
  id: number;
  fullname: string;
}

export async function getAssignableTeachers(): Promise<AssignableTeacher[]> {
  const { data } = await axiosBase.get<AssignableTeacher[]>(
    "assignable-teachers"
  );
  return data;
}
