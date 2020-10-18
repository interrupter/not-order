<script>
  import 'bulma-switch';
  import { createEventDispatcher } from 'svelte';
	let dispatch = createEventDispatcher();

  export let options = {};

  export let title = '';
  export let subtitle = '';

  export let switch_styling = '';
  export let readonly = false;
  export let disabled = false;

  function saveToServer(){
    dispatch('save', options);
  }

</script>

<h2 class="title is-2">{title}</h2>
<h3 class="subtitle is-3">{subtitle}</h3>
<div class="field is-horizontal">
  <div class="field-label">
    <label class="label" for="edit-order-options-redirect_of_requests_to_other_server">Перенаправление информации о новых заказах на другой сервер</label>
  </div>
  <div class="field-body">
    <div class="field">
      <div class="control">
        <input type="checkbox" class="switch {switch_styling}" id="edit-order-options-redirect_of_requests_to_other_server" bind:checked={options.redirect_of_requests_to_other_server.value} name="redirect_of_requests_to_other_server" {readonly} {disabled} />
        <label class="label" for="edit-order-options-redirect_of_requests_to_other_server"></label>
      </div>
    </div>
    {#if options.redirect_of_requests_to_other_server }
    <div class="field">
      <p class="control is-expanded">
        <input class="input is-success" type="text" placeholder="url куда предеавать данные" bind:value={options.redirect_of_requests_to_other_server_url.value}  {readonly} {disabled} />
      </p>
    </div>
    {/if}
  </div>
</div>

<div class="field is-horizontal">
  <div class="field-label">
    <!-- Left empty for spacing -->
  </div>
  <div class="field-body">
    <div class="field">
      <div class="control">
        <button class="button is-primary" on:click={saveToServer}>Сохранить</button>
      </div>
    </div>
  </div>
</div>
