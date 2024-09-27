const Schema = require("mongoose").Schema;

module.exports = {
    parent: "not-node//requiredObject",
    ui: {
        component: "UIOrderClient",
        readonly: true,
    },
    model: {
        type: [Schema.Types.Mixed],
        searchable: true,
        required: true,
    },
};
