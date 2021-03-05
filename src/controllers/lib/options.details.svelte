<script>
  import 'bulma-switch';
  import {UIError} from 'not-bulma';
  import { createEventDispatcher, onMount } from 'svelte';
	let dispatch = createEventDispatcher();

  const DEFAULT_OPTIONS = {
    redirect_of_requests_to_other_server: false,
    redirect_of_requests_to_other_server_url: '',
    inform_manager:    true,
    inform_client:     true
  };

  export let options = {
    ...DEFAULT_OPTIONS
  };

  export let title = '';
  export let subtitle = '';

  export let switch_styling = '';
  export let readonly = false;
  export let disabled = false;

  onMount(()=>{
    if(
      typeof options === 'undefined' ||
      options === null ||
      !options ||
      JSON.stringify(options)==='{}' ||
      Object.keys(options).length === 0
      ){
      options = {
        ...DEFAULT_OPTIONS
      };
    }
  });

  function saveToServer(){
    dispatch('save', options);
  }

</script>

<h2 class="title is-2">{title}</h2>
<h3 class="subtitle is-3">{subtitle}</h3>
{#if options }
<div class="field is-horizontal">
  <div class="field-label">
    <label class="label" for="edit-order-options-redirect_of_requests_to_other_server">Перенаправление информации о новых заказах на другой сервер</label>
  </div>
  <div class="field-body">
    <div class="field">
      <div class="control">
        <input type="checkbox" class="switch {switch_styling}" id="edit-order-options-redirect_of_requests_to_other_server" bind:checked={options.redirect_of_requests_to_other_server} name="redirect_of_requests_to_other_server" {readonly} {disabled} />
        <label class="label" for="edit-order-options-redirect_of_requests_to_other_server"></label>
      </div>
    </div>
    {#if options.redirect_of_requests_to_other_server }
    <div class="field">
      <p class="control is-expanded">
        <input class="input is-success" type="text" placeholder="url куда предеавать данные" bind:value={options.redirect_of_requests_to_other_server_url}  {readonly} {disabled} />
      </p>
    </div>
    {/if}
  </div>
</div>

<div class="field is-horizontal">
  <div class="field-label">
    <label class="label" for="edit-order-options-inform_manager">Информировать менеджера о заказе</label>
  </div>
  <div class="field-body">
    <div class="field">
      <div class="control">
        <input type="checkbox" class="switch {switch_styling}" id="edit-order-options-inform_manager" bind:checked={options.inform_manager} name="inform_manager" {readonly} {disabled} />
        <label class="label" for="edit-order-options-inform_manager"></label>
      </div>
    </div>
  </div>
</div>

<div class="field is-horizontal">
  <div class="field-label">
    <label class="label" for="edit-order-options-inform_client">Информировать клиента о заказе</label>
  </div>
  <div class="field-body">
    <div class="field">
      <div class="control">
        <input type="checkbox" class="switch {switch_styling}" id="edit-order-options-inform_client" bind:checked={options.inform_client} name="inform_client" {readonly} {disabled} />
        <label class="label" for="edit-order-options-inform_client"></label>
      </div>
    </div>
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
{:else}
<UIError title="Настройки отсутствуют" message="Данные или отсутствуют, или повреждены." />
{/if}
