const log = require("not-log")(module, "Order Model");

try {
    const MODEL_NAME = "Order";

    const FIELDS = [
        ["sessionId", {}, "session"],
        ["user", {}, "userId"],
        "client",
        ["content", {}, "orderContent"],
        ["status", {}, "orderStatus"],
        "ip",
        "createdAt",
        "updatedAt",
    ];

    exports.keepNotExtended = false;
    exports.thisModelName = MODEL_NAME;
    exports.FIELDS = FIELDS;

    exports.enrich = {
        versioning: true,
        increment: true,
        validators: true,
    };

    exports.thisStatics = {};

    exports.thisMethods = {};
} catch (e) {
    log.error(e);
}
