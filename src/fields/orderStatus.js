module.exports = {
    parent: "not-node//codeName",
    model: {
        type: String,
        required: true,
        default: "new",
    },
    ui: {
        component: "UITextfield",
        label: "Статус",
        placeholder: "статус заказа",
        readonly: true,
    },
};
