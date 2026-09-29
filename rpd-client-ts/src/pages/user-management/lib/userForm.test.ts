import { describe, expect, it } from "vitest";
import { UserRole } from "@shared/ability";
import type { User } from "@entities/user";
import {
  buildUserPayload,
  getUserFormDefaults,
  getUserFormSchema,
} from "./userForm";

const user: User = {
  id: 2,
  name: "teacher",
  role: UserRole.TEACHER,
  fullname: null,
  is_active: true,
};

describe("форма пользователя", () => {
  it("подставляет пустые поля для отсутствующего ФИО", () => {
    expect(getUserFormDefaults(user)).toMatchObject({
      surname: "",
      givenName: "",
      patronymic: "",
      password: "",
    });
  });

  it("не отправляет пустой пароль при редактировании", () => {
    const payload = buildUserPayload(
      { ...getUserFormDefaults(user), password: "" },
      true
    );
    expect(payload).not.toHaveProperty("password");
  });

  it("отправляет новый пароль при редактировании", () => {
    const payload = buildUserPayload(
      { ...getUserFormDefaults(user), password: " new-pass " },
      true
    );
    expect(payload.password).toBe(" new-pass ");
  });

  it("отправляет пароль при создании", () => {
    const payload = buildUserPayload(
      { ...getUserFormDefaults(null), password: "secret" },
      false
    );
    expect(payload.password).toBe("secret");
  });

  it("требует пароль при создании и разрешает пустой при редактировании", async () => {
    const values = {
      ...getUserFormDefaults(null),
      name: "teacher",
      surname: "Иванов",
      givenName: "Иван",
    };
    await expect(getUserFormSchema(false).validate(values)).rejects.toThrow(
      "Пароль обязателен"
    );
    await expect(
      getUserFormSchema(true).validate(values)
    ).resolves.toBeDefined();
  });

  it("проверяет длину исходного пароля без обрезки пробелов", async () => {
    const values = {
      ...getUserFormDefaults(user),
      name: "teacher",
      surname: "Иванов",
      givenName: "Иван",
      password: " a ",
    };
    await expect(
      getUserFormSchema(false).validate(values)
    ).resolves.toMatchObject({
      password: " a ",
    });
    await expect(
      getUserFormSchema(true).validate(values)
    ).resolves.toMatchObject({
      password: " a ",
    });
    await expect(
      getUserFormSchema(true).validate({ ...values, password: "  " })
    ).rejects.toThrow("От 3 до 50 символов");
  });
});
