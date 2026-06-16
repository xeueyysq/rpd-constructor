const async = require("async");
const murmurhash3js = require("murmurhash3js");
const traverse = require("traverse");
const UAParser = require("ua-parser-js");

function useragent(next) {
  const raw = String(this.req.headers["user-agent"] || "").slice(0, 512);
  const agent = new UAParser(raw).getResult();
  const browserVersion = agent.browser.version || "";
  const osVersion = agent.os.version || "";

  next(null, {
    useragent: {
      browser: {
        family: agent.browser.name || "",
        version: browserVersion.split(".")[0] || "",
      },
      device: {
        family: agent.device.model || agent.device.type || "",
        version: "",
      },
      os: {
        family: agent.os.name || "",
        major: osVersion.split(".")[0] || "",
        minor: osVersion.split(".")[1] || "",
      },
    },
  });
}

function acceptHeaders(next) {
  next(null, {
    acceptHeaders: {
      accept: this.req.headers.accept,
      language: this.req.headers["accept-language"],
    },
  });
}

function fingerprintMiddleware(setting) {
  const config = Object.assign(
    {
      parameters: [useragent, acceptHeaders],
    },
    setting
  );

  for (let i = 0; i < config.parameters.length; i++) {
    config.parameters[i] = config.parameters[i].bind(config);
  }

  return (req, res, next) => {
    const components = {};
    config.req = req;
    const fingerprint = { hash: null };

    async.eachLimit(
      config.parameters,
      1,
      (parameter, callback) => {
        parameter((err, obj) => {
          if (obj) {
            for (const key in obj) {
              components[key] = obj[key];
            }
          }
          callback(err);
        }, req, res);
      },
      (err) => {
        if (!err) {
          const leaves = traverse(components).reduce(function (acc, x) {
            if (this.isLeaf) {
              acc.push(x);
            }
            return acc;
          }, []);
          fingerprint.hash = murmurhash3js.x64.hash128(leaves.join("~~~"));
          fingerprint.components = components;
          req.fingerprint = fingerprint;
        }
        next();
      }
    );
  };
}

fingerprintMiddleware.useragent = useragent;
fingerprintMiddleware.acceptHeaders = acceptHeaders;

module.exports = fingerprintMiddleware;
