const getTransactionController = require("./getTransactionController");
const data = {
  userLaFactura: "usr-0281244c0f284596191a249479edfc27-v300",
  passLaFactura: "pwd-fcb52d9495cb3cfc1db4cee8aa3af390x-v300",
  networkId: 37899,
  access_key: "69445",
  type: "IN",
  flags: "45",
  transaction: "TESTE",
  urlMagaya: "https://37899.magayacloud.com/api/Invoke?Handler=CSSoapService",
};
(async () => {
  const response = getTransactionController(data);
})();
