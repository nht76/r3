export {MyInputIframe as default};

let MyInputIframe = {
	name:'my-input-iframe',
	template:`<div class="input-iframe">
		<div class="input-iframe-actions" :class="{ readonly:readonly }">
			<input class="input-iframe-input"
				v-model="srcInput"
				@keyup.enter="set"
				:disabled="readonly"
				:placeholder="capGen.threeDots"
			/>
			<my-button image="ok.png"
				v-if="!readonly"
				@trigger="set"
				:active="isChanged && !noInput"
				:naked="true"
				:tight="true"
			/>
			<my-button image="cancel.png"
				v-if="!readonly"
				@trigger="del"
				:active="src !== false"
				:naked="true"
				:tight="true"
			/>
			<my-button image="copyClipboard.png"
				v-if="clipboard"
				@trigger="$emit('copyToClipboard')"
				:active="src !== false"
				:naked="true"
				:tight="true"
			/>
		</div>
		<iframe class="input-iframe-content" allowfullscreen="true" frameBorder="0" height="100%" width="100%"
			v-if="isActive"
			:src="src"
		/>
		<div class="input-iframe-empty" v-if="!isActive">
			<span>{{ capApp.empty }}</span>
		</div>
	</div>`,
	props:{
		clipboard:  { type:Boolean, required:true },
		formLoading:{ type:Boolean, required:true },
		modelValue: { required:true },
		readonly:   { type:Boolean, required:true }
	},
	watch:{
		formLoading(val) {
			if(!val) this.reset();
		}
	},
	data() {
		return {
			srcInput:''
		};
	},
	emits:['copyToClipboard','update:modelValue'],
	computed:{
		// simple
		isActive: (s) => s.src !== false,
		isChanged:(s) => s.src !== s.srcInput,
		noInput:  (s) => s.srcInput === '',
		src:      (s) => s.modelValue !== null ? s.modelValue : false,
		
		// stores
		capApp:(s) => s.$store.getters.captions.input.iframe,
		capGen:(s) => s.$store.getters.captions.generic
	},
	mounted() {
		this.reset();
	},
	methods:{
		reset() {
			this.srcInput = this.modelValue === null ? '' : this.modelValue;
		},
		
		// actions
		del() {
			this.srcInput = '';
			this.$emit('update:modelValue',null);
		},
		set() {
			this.$emit('update:modelValue',this.srcInput);
		}
	}
};