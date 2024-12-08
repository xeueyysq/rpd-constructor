import {Ability, AbilityBuilder, AbilityClass} from "@casl/ability"
import {AppAbility, UserRole} from "../model/types"

const AppAbilityClass = Ability as AbilityClass<AppAbility>

const defineRulesFor = (role: UserRole) => {
    const {can, rules} = new AbilityBuilder(AppAbilityClass);

    switch (role) {
        case "anonymous":
            can("get", "auth");
            break;
        case "teacher":
            can("get", "teacher_interface");
            can("get", "lk");
            can("edit", "competencies");
            break;
        case "rop":
            can("get", "rop_interface");
            can("get", "lk");
            break;
        case "admin":
            can("get", "change_templates");
            can("get", "lk");
            break;
    }

    return rules;
};

export const buildAbilityFor = (role: UserRole = "anonymous"): AppAbility => {
    return new AppAbilityClass(defineRulesFor(role), {})
}

