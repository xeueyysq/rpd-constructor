import { axiosBase } from "@shared/api";

type TemplateFieldParams = {
  id: number;
  value: string;
};

export async function getTemplateField(params: {
  ids: number[];
  rowName: string | undefined;
}): Promise<TemplateFieldParams[]> {
  const { data } = await axiosBase.get<TemplateFieldParams[]>(
    "/get-changeable-values",
    {
      params,
    }
  );
  return data;
}
