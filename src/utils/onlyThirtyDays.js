const { format, subDays } = require("date-fns");

const onlyThirtyDays = async () => {
  const end_date = format(new Date(), "yyyy-MM-dd");
  const start_date = format(subDays(new Date(), 15), "yyyy-MM-dd");

  return {
    start_date,
    end_date,
  };
};

module.exports = onlyThirtyDays;
