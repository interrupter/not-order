<script>
	let overlay, inpForm, stage;

	import {
		UIOverlay,
		UIForm,
		Form,
		notCommon
	} from 'not-bulma';

	import { onMount, createEventDispatcher } from 'svelte';
	let dispatch = createEventDispatcher();

	export let manifest = false;
	export let options = {};
	export let validators = false;
	export let inline = false;
	export let order = {};
	export let data = {};
	export let url = '/api/order';
	export let closeOnClick = true;
	export let closeButton = false;
	export let resultShowtime = 1000;

	export let titleSuccess = 'Оформление заказа успешно завершено!';
	export let titleFailure = 'Во время оформления заказа произошла ошибка!';

	export let redirectSuccess = false;

	function overlayClosed(){
		rejectOrder();
	}

	onMount(()=>{
		if (manifest.actions.add && manifest.actions.add.fields){
	  	Form.actionFieldsInit(manifest.actions.add.fields, options, validators, data);
		}
	});

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

	async function putData(reqUrl, client) {
		let opts = getStandartRequestOptions();
		const response = await fetch(reqUrl, Object.assign(opts, {
			method: 'PUT',
			body: JSON.stringify({client, order}),
		}));
		return await response.json();
	}

	export let resolveOrder = (val) => {
			overlay.$destroy();
			dispatch('resolve', val);
		};

	export let rejectOrder = () => {
			overlay.$destroy();
			dispatch('reject', {});
		};

	function onSuccess(res){
		setTimeout(()=>{
			if(redirectSuccess){
				document.location.href = redirectSuccess;
			}else{
				resolveOrder(res);
			}
		}, resultShowtime);
	}

	function onValidationErrors(res){
		if (notCommon.isError(res)) {
			notCommon.report(res);
		} else {
			if (res.errors && Object.keys(res.errors).length > 0) {
				if (!Array.isArray(res.error)) {
					res.error = [];
				}
				Object.keys(res.errors).forEach((fieldName) => {
					inpForm.setFormFieldInvalid(fieldName, res.errors[fieldName]);
					res.error.push(...res.errors[fieldName]);
				});
			}
			if (res.error) {
				res.error.forEach(inpForm.addFormError);
			}
			if (!res.error) {
				inpForm.showSuccess();
			}
		}
	}

	function onException(e){
		inpForm.resetLoading();
		inpForm.addFormError(e.message);
	}

	export let putOrder = ({detail})=>{
		inpForm.setLoading();
		putData(url, detail)
			.then((res)=>{
				if(res.status === 'ok'){
					inpForm.showSuccess();
					onSuccess(res);
				}else{
					onValidationErrors(res);
				}
				inpForm.resetLoading();
			})
			.catch(onException);
	};

</script>

{#if inline }
<div class="order-form-paper box">
	<UIForm
		bind:this={inpForm}
		on:submit={putOrder}
		on:reject={rejectOrder}
		title={manifest.actions.add.title}
		description={manifest.actions.add.description}
		fields={manifest.actions.add.fields}
		SUCCESS_TEXT={titleSuccess}
		FAILURE_TEXT={titleFailure}
		validators=validators
		{options}
		submit={{caption: 'Отправить', enabled: true, classes: 'order-form-submit'}}
		cancel={{caption: 'Отмена', enabled: false, classes: 'order-form-cancel'}}
		/>
</div>
{:else }
<UIOverlay on:reject="{overlayClosed}" bind:this={overlay} show={true} {closeOnClick} {closeButton}>
	<div class="order-form-paper box">
		<UIForm
			bind:this={inpForm}
			on:submit={putOrder}
			on:reject={rejectOrder}
			title={manifest.actions.add.title}
			description={manifest.actions.add.description}
			fields={manifest.actions.add.fields}
			SUCCESS_TEXT={titleSuccess}
			FAILURE_TEXT={titleFailure}
			validators=validators
			{options}
			submit={{caption: 'Отправить', enabled: true, classes: 'order-form-submit'}}
			cancel={{caption: 'Отмена', enabled: true, classes: 'order-form-cancel'}}
			/>
	</div>
</UIOverlay>
{/if}
