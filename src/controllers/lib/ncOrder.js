import UIOrderContent from "./ui.order.content.svelte";
import UIOrderClient from "./ui.order.client.svelte";

import CommonLocal from "./index.js";
import Validators from "./validators.js";

import { ncCRUD, Form } from "not-bulma";

const LABELS = {
    plural: "Заказы",
    single: "Заказ",
};

const MODEL = "order";

class ncOrder extends ncCRUD {
    constructor(app, params, schemes) {
        super(app, `${CommonLocal.MODULE.name}.${MODEL}`);
        Form.addComponent("UIOrderContent", UIOrderContent);
        Form.addComponent("UIOrderClient", UIOrderClient);
        this.setModuleName(CommonLocal.MODULE.name);
        this.setModelName(MODEL);
        this.setOptions("names", LABELS);
        this.setOptions("Validators", Validators);
        this.setOptions("params", params);
        this.setOptions("role", "root");
        this.setOptions("urlSchemes", schemes);
        this.setOptions("list", {
            actions: app.getOptions("modules.order.list.actions", []),
            interface: {
                factory: this.getModel(),
                combined: true,
                combinedAction: "listAndCount",
            },
            pager: {
                size: 100,
                page: 0,
            },
            showSelect: false,
            showSearch: true,
            getItemId: (v) => v.orderID,
            idField: "_id",
            sorter: {
                orderID: -1,
            },
            fields: [
                {
                    path: ":orderID",
                    title: "ID",
                    searchable: true,
                    sortable: true,
                },
                {
                    path: ":client",
                    title: "Клиент",
                    type: "tag",
                    preprocessor: (value) => {
                        return [
                            {
                                id: 1,
                                color: "info",
                                title: "ФИО",
                                value: value.name,
                            },
                            {
                                id: 2,
                                color: "info",
                                title: "Тел",
                                value: value.tel,
                            },
                            {
                                id: 3,
                                color: "info",
                                title: "Email",
                                value: value.email,
                            },
                        ];
                    },
                },
                {
                    path: ":content",
                    title: "Заказ",
                    type: "tag",
                    preprocessor: (value) => {
                        let total = value.reduce(
                            (acc, itm) => {
                                acc.price += itm.item.price;
                                acc.count += itm.quantity;
                                return acc;
                            },
                            { price: 0, count: 0 }
                        );
                        total.price = (total.price / 100).toFixed(2);
                        return [
                            {
                                id: 1,
                                color: "warning",
                                title: "Цена",
                                value: `${total.price}`,
                            },
                            {
                                id: 2,
                                color: "info",
                                title: "Товаров",
                                value: value.length,
                            },
                            {
                                id: 3,
                                color: "info",
                                title: "Всего",
                                value: total.count,
                            },
                        ];
                    },
                },
                ...app.getOptions("modules.order.list.customFields", []),
                /*
			{
				path: ':status',
				title: 'Статус',
				searchable: true,
				sortable: true
			},
			*/
                {
                    path: ":createdAt",
                    title: "Дата создания",
                    searchable: true,
                    sortable: true,
                    preprocessor: (createdAt) => {
                        return new Date(createdAt).toLocaleString();
                    },
                },
                {
                    path: ":_id",
                    title: "Действия",
                    type: "button",
                    preprocessor: (value, row) => {
                        return [
                            {
                                action: () => this.goDetails(value),
                                title: "Подробнее",
                                size: "small",
                            },
                            ...app
                                .getOptions(
                                    "modules.order.list.row.actions",
                                    []
                                )
                                .map((itm) => {
                                    let btn = { ...itm };
                                    delete btn.action;
                                    btn.action = (e) =>
                                        itm.action(e, value, row);
                                    return btn;
                                }),
                        ];
                    },
                },
            ],
        });
        this.start();
        return this;
    }

    createDefault() {
        let newRecord = this.make[this.getModelName()]({});
        return newRecord;
    }

    getItemTitle(itm) {
        return `#${itm.orderID}`;
    }
}

export default ncOrder;
