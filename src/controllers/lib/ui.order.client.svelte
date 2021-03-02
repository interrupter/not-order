<script>
  export let value        = {};
  export let readonly     = true;
  export let disabled     = true;
</script>

<div class="box">
  <h4 class="title is-4">Заказчик</h4>
  <h5 class="subtitle is-5">Данные из формы заказа</h5>
  <div class="field is-horizontal">
    <div class="field-label">
      <label class="label" for="order_client_value_name">Имя</label>
    </div>
    <div class="field-body">
      <div class="field">
        <p class="control is-expanded">
          <input id="order_client_value_name" class="input is-success" type="text" placeholder="имя" bind:value={value.name} {readonly} {disabled} />
        </p>
      </div>
    </div>
  </div>
  <div class="field is-horizontal">
    <div class="field-label">
      <label class="label" for="order_client_value_tel">Телефон</label>
    </div>
    <div class="field-body">
      <div class="field">
        <p class="control is-expanded">
          <input id="order_client_value_tel" class="input is-success" type="text" placeholder="телефон" bind:value={value.tel} {readonly} {disabled} />
        </p>
      </div>
    </div>
  </div>
  <div class="field is-horizontal">
    <div class="field-label">
      <label class="label" for="order_client_value_email">Email</label>
    </div>
    <div class="field-body">
      <div class="field">
        <p class="control is-expanded">
          <input id="order_client_value_email" class="input is-success" type="text" placeholder="email" bind:value={value.email} {readonly} {disabled} />
        </p>
      </div>
    </div>
  </div>
  <div class="field is-horizontal">
    <div class="field-label">
      <label class="label" for="order_client_value_comment">Комментарий</label>
    </div>
    <div class="field-body">
      <div class="field">
        <p class="control is-expanded">
          <textarea id="order_client_value_comment"
            class="textarea"
            {disabled} {readonly}
            bind:value={value.comment}
            name="client_comment"
            placeholder="Комментарий" rows="6" cols="80"
            ></textarea>
        </p>
      </div>
    </div>
  </div>
</div>
