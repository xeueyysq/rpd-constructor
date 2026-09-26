import type { Request, Response, NextFunction } from "express";
import type { RequestFingerprint } from "../types/express.ts";
import async from "async";
import murmurhash3js from "murmurhash3js";
import traverse from "traverse";
import { UAParser } from "ua-parser-js";

type FingerprintNext = (err: Error | null, obj?: Record<string, unknown>) => void;
type FingerprintParameter = (this: FingerprintContext, next: FingerprintNext, req?: Request, res?: Response) => void;
type FingerprintContext = { req: Request; parameters: FingerprintParameter[] };

function useragent(this: FingerprintContext, next: FingerprintNext) {
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

function acceptHeaders(this: FingerprintContext, next: FingerprintNext) {
  next(null, {
    acceptHeaders: {
      accept: this.req.headers.accept,
      language: this.req.headers["accept-language"],
    },
  });
}

function fingerprintMiddleware(setting: { parameters?: FingerprintParameter[] } = {}) {
  const config = Object.assign(
    {
      parameters: [useragent, acceptHeaders],
    },
    setting
  ) as FingerprintContext;

  for (let i = 0; i < config.parameters.length; i++) {
    config.parameters[i] = config.parameters[i].bind(config);
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const components: Record<string, unknown> = {};
    config.req = req;
    const fingerprint: RequestFingerprint = { hash: null, components };

    async.eachLimit(
      config.parameters,
      1,
      (parameter, callback) => {
        parameter.call(config, (err, obj) => {
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
          const leaves: unknown[] = traverse(components).reduce(function (this: traverse.TraverseContext, acc: unknown[], x: unknown) {
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

export default fingerprintMiddleware;
