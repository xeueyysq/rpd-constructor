import {Ability} from "@casl/ability"

export type Actions = "get" | "edit"
export type Subjects =
    | "auth"
    | "lk"
    | "rop_interface"
    | "teacher_interface"
    | "change_templates"
    | "competencies"

export type UserRole = "anonymous" | "teacher" | "rop" | "admin"
export type AppAbility = Ability<[Actions, Subjects]>
