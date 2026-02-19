import { Ability, AbilityBuilder, AbilityClass } from "@casl/ability";
import { AppAbility } from "../model/types";
import { UserRole } from "../model/enums";

const AppAbilityClass = Ability as AbilityClass<AppAbility>;

const defineRulesFor = (role: UserRole) => {
  const { can, rules } = new AbilityBuilder(AppAbilityClass);

  switch (role) {
    case UserRole.ANONYMOUS:
      can("get", "auth");
      break;
    case UserRole.TEACHER:
      can("get", "teacher_interface");
      can("get", "lk");
      can("edit", "competencies");
      break;
    case UserRole.ROP:
      can("get", "rop_interface");
      can("get", "lk");
      break;
    case UserRole.ADMIN:
      can("get", "change_templates");
      can("get", "admin_tabs");
      can("get", "lk");
      break;
  }

  return rules;
};

export const buildAbilityFor = (
  role: UserRole = UserRole.ANONYMOUS
): AppAbility => {
  return new AppAbilityClass(defineRulesFor(role), {});
};
