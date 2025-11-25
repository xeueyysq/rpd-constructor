const RpdComplects = require("../models/rpd_complects");
const Rpd1cExchange = require("../models/rpd_1c_exchange");

async function findRpdComplect(pool, complectId) {
  const rpdComplects = new RpdComplects(pool);
  return await rpdComplects.findRpdComplectMeta(complectId);
}

async function findRpd(pool, complectId) {
  const rpdComplects = new RpdComplects(pool);
  const rpd1cExchange = new Rpd1cExchange(pool);

  const complectMeta = await rpdComplects.findRpdComplectMeta(complectId);
  const complectTemplates = await rpd1cExchange.findRpd(complectId);
  return {
    ...complectMeta,
    templates: complectTemplates,
  };
}

module.exports = { findRpdComplect, findRpd };
