const Schema = require("mongoose").Schema;

module.exports = {
    parent: "not-node//requiredObject",
    model: {
        type: Schema.Types.Mixed,
        searchable: true,
        required: true,
    },
    ui: {
        component: "UIOrderClient",
        readonly: true,
    },
};
