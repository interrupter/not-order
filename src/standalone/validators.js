import validator from "validator";

const Validators = {
    fields: {
        name(value) {
            let errors = [];
            if (
                !validator.isLength(value, {
                    min: 2,
                    max: 100,
                })
            ) {
                errors.push("Минимальная длина 2 знака, максимальная 100");
            }
            return errors;
        },
        tel(value) {
            let errors = [];
            if (!validator.isMobilePhone(value.replace(/\D/g, ""))) {
                errors.push("Необходимо ввести номер мобильного телефона");
            }
            return errors;
        },
        comment(value) {
            let errors = [];
            if (!validator.isLength(value, { min: 0, max: 1000 })) {
                errors.push("Текст может содержать до 1000 символов.");
            }
            return errors;
        },
        email(value) {
            let errors = [];
            if (!validator.isEmail(value)) {
                errors.push("Необходимо ввести email адрес");
            }
            return errors;
        },
    },
    forms: {
        edit(/*form*/) {
            let errors = {
                clean: true,
                fields: {},
                form: [],
            };
            return errors;
        },
    },
};

export default Validators;
