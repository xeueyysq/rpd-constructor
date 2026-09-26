import RpdComplects from "../models/rpd_complects.ts";
import Rpd1cExchange from "../models/rpd_1c_exchange.ts";

async function findRpd(pool, complectId) {
  const rpdComplects = new RpdComplects(pool);
  const rpd1cExchange = new Rpd1cExchange(pool);

  const complectMeta = await rpdComplects.findRpdComplectMeta(complectId);

  if (!complectMeta || !complectMeta.id) {
    throw new Error("Комплект не найден");
  }

  const numericComplectId = complectMeta.id;
  const complectTemplates = await rpd1cExchange.findRpd(numericComplectId);
  return {
    ...complectMeta,
    templates: complectTemplates,
  };
}

export { findRpd };
