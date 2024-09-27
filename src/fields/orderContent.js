const Schema = require("mongoose").Schema;

module.exports = {
    parent: "not-node//requiredObject",
    ui: {
        component: "UIOrderContent",
        readonly: true,
    },
    model: {
        type: [Schema.Types.Mixed],
        searchable: true,
        required: true,
    },
};
