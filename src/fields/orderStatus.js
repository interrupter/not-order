module.exports = {
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
