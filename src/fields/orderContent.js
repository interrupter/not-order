const Schema = require("mongoose").Schema;

module.exports = {
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
