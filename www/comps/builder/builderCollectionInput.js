import {
	getDependentModules,
	getItemTitleColumn
} from '../shared/builder.js';
export {MyBuilderCollectionInput as default};

let MyBuilderCollectionInput = {
	name:'my-builder-collection-input',
	template:`
		<tr>
			<td>{{ caption }}</td>
			<td>
				<select v-model="collectionIdInput">
					<option :value="null">-</option>
					<optgroup
						v-for="m in getDependentModules(module,modules).filter(v => v.collections.length !== 0)"
						:label="m.name"
					>
						<option v-for="c in m.collections" :value="c.id">
							{{ c.name }}
						</option>
					</optgroup>
				</select>
				<select v-model="columnIdInput" v-if="collectionIdInput !== null">
					<option :value="null" disabled="disabled">{{ capApp.collectionColumn }}</option>
					<option v-if="collectionIdInput !== null" v-for="c in collectionIdMap[collectionIdInput].columns" :value="c.id">
						{{ getItemTitleColumn(c) }}
					</option>
				</select>
				
				<div class="collections-option" v-if="showMultiValue">
					<span>{{ capApp.collectionMultiValue }}</span>
					<my-bool v-model="multiValueInput" />
				</div>
			</td>
			<td>
				<my-button image="cancel.png"
					v-if="allowRemove"
					@trigger="$emit('remove')"
					:naked="true"
				/>
			</td>
		</tr>
	`,
	props:{
		allowRemove:   { type:Boolean, required:true },
		caption:       { type:String,  required:true },
		consumer:      { required:true },
		module:        { type:Object,  required:true },
		showMultiValue:{ type:Boolean, required:true }
	},
	emits:['remove','update:consumer'],
	computed:{
		consumerInput:{
			get() {
				return this.consumer !== null
					? JSON.parse(JSON.stringify(this.consumer))
					: {
						collectionId:null,
						columnIdDisplay:null,
						multiValue:false
					};
			}
		},
		
		collectionIdInput:{
			get()  { return this.consumerInput.collectionId },
			set(v) { this.set('collectionId',v) }
		},
		columnIdInput:{
			get()  { return this.consumerInput.columnIdDisplay },
			set(v) { this.set('columnIdDisplay',v) }
		},
		multiValueInput:{
			get()  { return this.consumerInput.multiValue },
			set(v) { this.set('multiValue',v) }
		},
		
		// stores
		modules:        (s) => s.$store.getters['schema/modules'],
		collectionIdMap:(s) => s.$store.getters['schema/collectionIdMap'],
		capApp:         (s) => s.$store.getters.captions.builder.form
	},
	methods:{
		// externals
		getDependentModules,
		getItemTitleColumn,
		
		// actions
		set(name,value) {
			let v = JSON.parse(JSON.stringify(this.consumerInput));
			v[name] = value;
			
			if(name === 'collectionId') {
				if(value === 'null') v = null;
				else                 v.columnIdDisplay = null;
			}
			this.$emit('update:consumer',v);
		}
	}
};