const { Parser } = require("xml2js");

const parseXmlString = async (xml) => {
  const parser = new Parser({ explicitArray: false, mergeAttrs: true });

  return new Promise((resolve, reject) => {
    parser.parseString(xml, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

module.exports = parseXmlString;
