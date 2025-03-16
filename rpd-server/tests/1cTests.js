const { fetchUpLink, fetchDiscInfo } = require("../app/modules/1cExchange");

const apiData = {
  year: "2022",
  educationLevel: "бак",
  educationForm: "очн",
  direction: "Информатика и вычислительная техника",
};

(async () => {
  const upLink = await fetchUpLink(apiData);
  console.log(upLink[0].upLink);
  console.log(await fetchDiscInfo(upLink[0].upLink));
})();
