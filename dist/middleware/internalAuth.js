"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.internalAuth = void 0;
const environment_1 = require("../config/environment");
const internalAuth = async (request, reply, done) => {
    const apiKey = request.headers['x-internal-key'];
    if (!apiKey) {
        reply.code(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Missing x-internal-key header'
        });
        return;
    }
    if (apiKey !== environment_1.INTERNAL_API_KEY) {
        reply.code(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Invalid x-internal-key'
        });
        return;
    }
    done();
};
exports.internalAuth = internalAuth;
//# sourceMappingURL=internalAuth.js.map