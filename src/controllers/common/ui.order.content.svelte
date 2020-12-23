<script>
  let totalItems = 0,
    totalPrice = 0;

  import {
    onMount
  } from 'svelte';

  export let value = [];
  export let readonly = true;

  onMount(() => {
    value.forEach((item) => {
      totalItems += item.quantity;
      totalPrice += (item.quantity * item.item.price);
    });
  });

  function formatPrice(price) {
    let rub = parseInt(Math.floor(price / 100)),
      cop = parseInt(price % 100);
    rub = '' + rub;
    return `${rub}.${cop}`;
  }
</script>

<div class="box">
  <h4 class="title is-4">Заказ</h4>
  <div class="box level">
    <div class="level-left">
      Продуктов(общее кол-во): {value.length}({totalItems})
    </div>
    <div class="level-right">
      Стоимость: {formatPrice(totalPrice)}
    </div>
  </div>
  <div class="box">
    {#each value as item}
    <div class="control">
      <div class="mx-1 tags has-addons">
        <span class="tag">Название</span>
        <span class="tag is-info">{item.item.title}</span>
      </div>
      <div class="mx-1 tags has-addons">
        <span class="tag">Количество</span>
        <span class="tag is-info">{item.quantity}</span>
      </div>
      <div class="mx-1 tags has-addons">
        <span class="tag">Цена за единицу</span>
        <span class="tag is-info">{formatPrice(item.item.price)}</span>
      </div>
      <div class="mx-1 tags has-addons">
        <span class="tag">Всего</span>
        <span class="tag is-info">{formatPrice(item.item.price * item.quantity)}</span>
      </div>
    </div>
    {#if item.image }
    <div class="control">
      <figure class="image">
        <img src="{item.image.path.small.cloud.Location}">
      </figure>
    </div>
    {/if}
    {#if item.url }
    <div class="control">
      <a href="{item.url}" class="button">Страница продукта</a>
    </div>
    {/if}
    {/each}
  </div>
</div>
