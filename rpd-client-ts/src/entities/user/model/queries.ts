import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUser,
  getUsers,
  getAssignableTeachers,
  setUsersActive,
  updateUser,
} from "../api/users";
import type { UserPayload } from "./types";

const usersQueryKey = ["users"] as const;

export function useUsers() {
  return useQuery({ queryKey: usersQueryKey, queryFn: getUsers });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersQueryKey }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UserPayload }) =>
      updateUser(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersQueryKey }),
  });
}

export function useSetUsersActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, isActive }: { ids: number[]; isActive: boolean }) =>
      setUsersActive(ids, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersQueryKey }),
  });
}

export function useAssignableTeachers() {
  return useQuery({
    queryKey: ["assignable-teachers"],
    queryFn: getAssignableTeachers,
  });
}
