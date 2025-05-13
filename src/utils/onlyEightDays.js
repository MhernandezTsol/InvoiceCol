const { format, subDays } = require("date-fns");

const onlyEightDays = async () => {
  const end_date = format(new Date(), "yyyy-MM-dd");
  const start_date = format(subDays(new Date(), 8), "yyyy-MM-dd");

  return {
    start_date,
    end_date,
  };
};

module.exports = onlyEightDays;
