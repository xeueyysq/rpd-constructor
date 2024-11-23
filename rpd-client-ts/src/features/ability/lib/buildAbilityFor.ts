import {Ability, AbilityBuilder, AbilityClass} from "@casl/ability";
import {AppAbility, UserRole} from "../model/types.ts";

export const AppAbilityClass = Ability as AbilityClass<AppAbility>;

const defineRulesFor = (role: UserRole) => {
    const {can, rules} = new AbilityBuilder(AppAbilityClass);

    if (role === "anonymous") {
        can("get", "auth")
    }
    if (role === "teacher") {
        can("get", "teacher_interface");
        can("get", "lk");
        can("edit", "competencies");
    } else if (role === "rop") {
        can("get", "rop_interface");
        can("get", "lk");
    } else if (role === "admin") {
        can("get", "change_templates");
        can("get", "lk");
    }

    return rules;
};

export const buildAbilityFor = (role: UserRole): AppAbility => {
    return new AppAbilityClass(defineRulesFor(role), {});
};
