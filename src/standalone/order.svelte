
<script>
	let overlay;
	let stage = 'filling';
	let errorMessage = '';
	let validationErrors = {
		tel: false,
		name: false,
		email: false,
		comment: false
	};

	import {
		OverlayComponentStandalone
	} from 'not-overlay';
	import {
		Icon as CommonIcon
	} from '@smui/common';
	import IconButton, {
		Icon
	} from '@smui/icon-button';
	import Button, {
		Label
	} from '@smui/button';
	import Textfield from '@smui/textfield';
	import HelperText from '@smui/textfield/helper-text';
	import Paper, {Title, Subtitle, Content} from '@smui/paper';

	import {createEventDispatcher} from 'svelte';
	let dispatch = createEventDispatcher();

	export let title = 'Оформление заказа';
	export let description = '';
	export let url = '/api/order';
	export let closeOnClick = true;
	export let closeButton = false;
	export let resultShowtime = 1000;

	export let titleSuccess = 'Оформление заказа успешно завершено!';
	export let titleFailure = 'Во время оформления заказа произошла ошибка!';

	export let redirectSuccess = false;
	export let redirectFailure = false;

	export let order = {};

	export let tel = {
		label: 'Ваш номер телефона',
		placeholder: '',
		enabled: true,
		value: '',
		required: true
	};

	export let email = {
		label: 'Email',
		placeholder: 'Ваш email адрес',
		enabled: true,
		value: '',
		required: true
	};

	export let name = {
		label: 'Имя',
		placeholder: 'Как нам к вам обращаться?',
		value: '',
		enabled: true,
		required: true
	};

	export let comment = {
		label: 'Дополнительно',
		placeholder: 'Дополнительные сведения',
		value: '',
		enabled: true,
		required: true
	};

	export let submit = {
		caption: 'Отправить'
	};

	export let cancel = {
		caption: 'Назад'
	};

	function overlayClosed(){
		rejectOrder();
	}

	function collectData(){
		return {
			client:{
				tel: tel.enabled?tel.value:'',
				name: name.enabled?name.value:'',
				email: email.enabled?email.value:'',
				comment: comment.enabled?comment.value:'',
			},
			order
		};
	}

	function getStandartRequestOptions() {
		return {
			mode: 'cors', 													// no-cors, *cors, same-origin
			cache: 'no-cache', 											// *default, no-cache, reload, force-cache, only-if-cached
			credentials: 'same-origin', 						// include, *same-origin, omit
			headers: {
				'Content-Type': 'application/json'
			},
			redirect: 'error', 											// manual, *follow, error
			referrerPolicy: 'no-referrer', 					// no-referrer, *client
		};
	}

	async function putData(reqUrl, data) {
		let opts = getStandartRequestOptions();
		const response = await fetch(reqUrl, Object.assign(opts, {
			method: 'PUT',
			body: JSON.stringify(data)
		}));
		return await response.json();
	}

	export let resolveOrder = (data) => {
			overlay.$destroy();
			dispatch('resolve', data);
		};

	export let rejectOrder = () => {
			overlay.$destroy();
			dispatch('reject', {});
		};

	function onSuccess(res){
		stage = 'success';
		setTimeout(()=>{
			if(redirectSuccess){
				document.location.href = redirectSuccess;
			}else{
				resolveOrder(res);
			}
		}, resultShowtime);
	}

	function onValidationErrors(res){
		stage = 'failure';
		errorMessage = res.message;
		validationErrors = res.errors;
		setTimeout(()=>{
			stage = 'filling';
		}, resultShowtime);
	}

	function onException(e){
		stage = 'failure';
		errorMessage = e.message;
		setTimeout(()=>{
			if(redirectFailure){
				document.location.href = redirectSuccess;
			}else{
				rejectOrder(e);
			}
		}, resultShowtime);
	}

	export let putOrder = ()=>{
		stage = 'loading';
		putData(url, collectData())
			.then((res)=>{
				if(res.status === 'ok'){
					onSuccess(res);
				}else{
					onValidationErrors(res);
				}
			})
			.catch(onException);
	};
	$: telHelper = validationErrors.tel?validationErrors.tel.join(', '):tel.placeholder;
	$: nameHelper = validationErrors.name?validationErrors.name.join(', '):name.placeholder;
	$: emailHelper = validationErrors.email?validationErrors.email.join(', '):email.placeholder;
	$: commentHelper = validationErrors.comment?validationErrors.comment.join(', '):comment.placeholder;
</script>

<OverlayComponentStandalone on:reject="{overlayClosed}" bind:this={overlay} show={true} {closeOnClick} {closeButton}>
	<Paper class="order-form-paper">
  	<Title>{title}</Title>
  	<Subtitle>{description}</Subtitle>
  	<Content>
			{#if stage === 'filling'}
			<div class="order-form">
				{#if tel.enabled}
				<div class="order-form-tel">
					<Textfield invalid="{validationErrors.tel}" variant="outlined" placeholder="{tel.placeholder}" type="tel" required={tel.required} pattern="[0-9]{1}-[0-9]{3}-[0-9]{3}-[0-9]{4}" bind:value={tel.value}
					label="{tel.label}"
					input$aria-controls="input-field-helper-tel"
					input$aria-describedby="input-field-helper-tel" />
					<HelperText id="input-field-helper-tel">{telHelper}</HelperText>
				</div>
				{/if}
				{#if email.enabled}
				<div class="order-form-email">
					<Textfield invalid="{validationErrors.email}" variant="outlined" type="email" bind:value={email.value} required={email.required} placeholder="{email.placeholder}" label="" input$autocomplete="email"
					input$aria-controls="input-field-helper-email"
					input$aria-describedby="input-field-helper-email"
					>
						<span slot="label">
							<CommonIcon class="material-icons" style="font-size: 1em; line-height: normal; vertical-align: middle;">email</CommonIcon> {email.label}
						</span>
					</Textfield>
					<HelperText id="input-field-helper-email">{emailHelper}</HelperText>
				</div>
				{/if}
				{#if name.enabled}
				<div class="order-form-name">
					<Textfield  invalid="{validationErrors.name}" variant="outlined" type="text" bind:value={name.value} required={name.required} placeholder="{name.placeholder}" label="{name.label}" input$autocomplete="name"
					 input$aria-controls="input-field-helper-name" input$aria-describedby="input-field-helper-name"
					/>
					<HelperText id="input-field-helper-name">{nameHelper}</HelperText>
				</div>
				{/if}
				{#if comment.enabled}
				<div class="order-form-comment">
					<Textfield fullwidth invalid={validationErrors.comment} textarea bind:value={comment.value} label="{comment.label}" input$aria-controls="input-field-helper-comment" input$aria-describedby="input-field-helper-comment" />
					<HelperText id="input-field-helper-comment">{commentHelper}</HelperText>
				</div>
				{/if}
				<div class="buttons-row">
					<Button on:click={rejectOrder} variant="outlined" color="secondary" class="order-form-cancel">
						<Label>{cancel.caption}</Label>
					</Button>
					<Button on:click={putOrder} variant="raised" color="primary" class="order-form-submit pull-right">
						<Label>{submit.caption}</Label>
					</Button>
				</div>
			</div>
			{/if}
			{#if stage === 'loading'}
			<div class="lds-ellipsis"><div></div><div></div><div></div><div></div></div>
			{/if}
			{#if stage === 'success'}
			<div class="centered">{titleSuccess}</div>
			{/if}
			{#if stage === 'failure'}
			<div class="centered">{titleFailure} ({errorMessage})</div>
			{/if}
  	</Content>
	</Paper>
</OverlayComponentStandalone>

<style>
.centered{
	text-align: center;
	display: block;
	margin: auto auto;
	position: relative;
	width: 80%;
	height: auto;
}
</style>
