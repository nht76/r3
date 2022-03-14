import {
	aesGcmDecryptBase64,
	aesGcmDecryptBase64WithPhrase,
	aesGcmEncryptBase64,
	aesGcmEncryptBase64WithPhrase,
	aesGcmImportBase64,
	pbkdf2PassToAesGcmKey,
	pemExport,
	pemImport,
	rsaGenerateKeys
} from './shared/crypto.js';
import {
	set as setSetting,
	setLoginKeys
} from './shared/settings.js';
export {MySettings as default};

let MySettingsEncryption = {
	name:'my-settings-encryption',
	template:`<div class="encryption">
	
		<p>{{ capApp.description }}</p>
		
		<table>
			<tr>
				<td class="minimum">{{ capGen.status }}:</td>
				<td><b>{{ statusCaption }}</b></td>
			</tr>
		</table>
		<br />
		
		<!-- create new key pair -->
		<template v-if="loginKeyAes !== null && !loginEncryption">
			<my-button
				v-if="!newKeys"
				@trigger="createKeys"
				:active="!running"
				:caption="capApp.button.createKeys"
				:image="!running ? 'add.png' : 'load.gif'"
			/>
			
			<!-- newly created keys ready for storage -->
			<template v-if="newKeys">
				<h2>{{ capApp.newKeys }}</h2>
				<p>{{ capApp.newKeysDesc }}</p>
				
				<h2>{{ capApp.backupCode }}</h2>
				<div class="backup-code shade">{{ newBackupCode }}</div>
				<p v-html="capApp.backupCodeDesc"></p>
				
				<table>
					<tr>
						<td><my-bool v-model="confirmBackupCode" /></td>
						<td>{{ capApp.confirmBackupCode }}</td>
					</tr>
					<tr>
						<td><my-bool v-model="confirmEncryption" /></td>
						<td>{{ capApp.confirmEncryption }}</td>
					</tr>
				</table>
				<br />
				<br />
				
				<my-button image="key.png"
					@trigger="updateKeys(newKeyPrivateEnc,newKeyPrivateEncBackup,newKeyPair.privateKey,newKeyPair.publicKey)"
					:active="!running && confirmBackupCode && confirmEncryption"
					:caption="capApp.button.storeKeys"
				/>
			</template>
		</template>
		
		<!-- recover access -->
		<template v-if="locked">
			<h2>{{ capApp.regainAccess }}</h2>
			<p>{{ capApp.regainAccessDesc }}</p>
			
			<table class="default-inputs">
				<tr>
					<td>{{ capApp.prevPassword }}</td>
					<td><input v-model="regainPassword" /></td>
					<td>
						<my-button image="key.png"
							@trigger="unlockWithPassphrase"
							:active="regainPassword !== ''"
							:caption="capGen.button.unlock"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.backupCode }}</td>
					<td><textarea v-model="regainBackupCode"></textarea></td>
					<td>
						<my-button image="key.png"
							@trigger="unlockWithBackupCode"
							:active="regainBackupCode !== ''"
							:caption="capGen.button.unlock"
						/>
					</td>
				</tr>
			</table>
		</template>
	</div>`,
	data:function() {
		return {
			running:false,
			
			// user confirmations for enabling encryption
			confirmBackupCode:false,
			confirmEncryption:false,
			
			// newly created keys to be stored
			newBackupCode:null,
			newKeyPair:null,
			newKeyPrivateEnc:null,
			newKeyPrivateEncBackup:null,
			
			// regain access
			regainBackupCode:'',
			regainPassword:''
		};
	},
	computed:{
		statusCaption:function() {
			if(!this.active) return this.capApp.status.inactive;
			if(this.locked)  return this.capApp.status.locked;
			return this.capApp.status.unlocked;
		},
		
		// states
		active: function() { return this.loginEncryption; },
		locked: function() { return this.active && this.loginPrivateKey === null; },
		newKeys:function() { return this.newKeyPrivateEnc !== null; },
		
		// stores
		loginKeyAes:       function() { return this.$store.getters['local/loginKeyAes']; },
		loginKeySalt:      function() { return this.$store.getters['local/loginKeySalt']; },
		loginEncryption:   function() { return this.$store.getters.loginEncryption; },
		loginPrivateKey:   function() { return this.$store.getters.loginPrivateKey; },
		loginPrivateKeyEnc:function() { return this.$store.getters.loginPrivateKeyEnc; },
		loginPrivateKeyEncBackup:function() { return this.$store.getters.loginPrivateKeyEncBackup; },
		loginPublicKey:    function() { return this.$store.getters.loginPublicKey; },
		capApp:            function() { return this.$store.getters.captions.settings.encryption; },
		capErr:            function() { return this.$store.getters.captions.error; },
		capGen:            function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		aesGcmDecryptBase64,
		aesGcmDecryptBase64WithPhrase,
		aesGcmEncryptBase64,
		aesGcmEncryptBase64WithPhrase,
		aesGcmImportBase64,
		pbkdf2PassToAesGcmKey,
		pemExport,
		pemImport,
		rsaGenerateKeys,
		setLoginKeys,
		
		generateBackupCode:function() {
			let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
			let len   = 128;
			let arr   = new Uint32Array(len);
			let out   = '';
			crypto.getRandomValues(arr);
			for(let i = 0; i < len; i++) {
				out += chars[arr[i] % chars.length];
			}
			return out;
		},
		createKeys:function() {
			this.running = true;
			const backupCode     = this.generateBackupCode();
			const backupCodeShow = backupCode.replace(/.{4}/g, '$& '); // add spaces every 4 chars
			
			// generate RSA key pair for user
			// import login AES key for encryption of private key
			Promise.all([
				this.rsaGenerateKeys(true,4096),
				this.aesGcmImportBase64(this.loginKeyAes)
			]).then(
				res => {
					const keyPair  = res[0];
					const keyLogin = res[1];
					
					// export both keys as PEM
					Promise.all([
						this.pemExport(keyPair.privateKey),
						this.pemExport(keyPair.publicKey)
					]).then(
						keysPem => {
							const pemPrivate = keysPem[0];
							const pemPublic  = keysPem[1];
							
							// encrypt private key twice (once with login key, once with backup code)
							Promise.all([
								this.aesGcmEncryptBase64(pemPrivate,keyLogin),
								this.aesGcmEncryptBase64WithPhrase(pemPrivate,backupCode)
							]).then(
								res => {
									this.newBackupCode          = backupCodeShow;
									this.newKeyPair             = keyPair;
									this.newKeyPrivateEnc       = res[0];
									this.newKeyPrivateEncBackup = res[1];
									this.running                = false;
								}
							);
						}
					);
				},
				// none of these processes should fail
				err => this.$root.genericError(err)
			);
		},
		
		unlockError:function() {
			this.$store.commit('dialog',{
				captionBody:this.capErr.SEC['002'],
				image:'key.png',
				buttons:[{
					cancel:true,
					caption:this.capGen.button.close,
					keyEscape:true,
					image:'cancel.png'
				}]
			});
		},
		
		unlockWithBackupCode:function() {
			// remove spaces from backup code input
			const backupCode = this.regainBackupCode.replace(/\s/g,'');
			
			// attempt to decrypt private key with backup code
			this.aesGcmDecryptBase64WithPhrase(this.loginPrivateKeyEncBackup,backupCode).then(
				res => this.renewPrivateKeyEnc(res),
				err => this.unlockError()
			);
		},
		unlockWithPassphrase:function() {
			this.pbkdf2PassToAesGcmKey(this.regainPassword,this.loginKeySalt,10000,true).then(
				loginKeyOld => {
					// attempt to decrypt private key with login key based on previous password
					this.aesGcmDecryptBase64(this.loginPrivateKeyEnc,loginKeyOld).then(
						res => this.renewPrivateKeyEnc(res),
						err => this.unlockError()
					);
				},
				err => this.$root.genericError(err)
			);
		},
		renewPrivateKeyEnc:function(privateKeyPem) {
			Promise.all([
				this.pemImport(privateKeyPem,'RSA',false), // import private key PEM
				this.aesGcmImportBase64(this.loginKeyAes)  // import current login key
			]).then(
				res => {
					const privateKey = res[0];
					const loginKey   = res[1];
					
					// encrypt private key with current login key
					this.aesGcmEncryptBase64(privateKeyPem,loginKey).then(
						privateKeyEnc => this.setLoginKeys(
							privateKeyEnc,                 // newly encrypted private key
							this.loginPrivateKeyEncBackup, // backup code did not change
							privateKey,
							this.loginPublicKey
						)
					);
				},
				err => this.$root.genericError(err)
			);
		},
		
		// backend calls
		updateKeys:function(privateKeyEnc,privateKeyEncBackup,privateKey,publicKey) {
			this.setLoginKeys(privateKeyEnc,privateKeyEncBackup,privateKey,publicKey).then(
				res => {
					this.newBackupCode          = null;
					this.newKeyPair             = null;
					this.newKeyPrivateEnc       = null;
					this.newKeyPrivateEncBackup = null;
				},
				err => this.$root.genericError(err)
			);
		}
	}
};

let MySettingsAccount = {
	name:'my-settings-account',
	template:`<div>
		<table class="default-inputs">
			<tbody>
				<!-- pw change -->
				<tr>
					<td>{{ capGen.username }}</td>
					<td>	<input disabled="disabled" :value="loginName" /></td>
				</tr>
				<tr>
					<td>{{ capApp.pwOld }}</td>
					<td>	<input v-model="pwOld" @input="messageClear" type="password" /></td>
				</tr>
				<tr>
					<td>{{ capApp.pwNew0 }}</td>
					<td>	<input v-model="pwNew0" @input="messageClear" type="password" /></td>
				</tr>
				<tr>
					<td>{{ capApp.pwNew1 }}</td>
					<td>	<input v-model="pwNew1" @input="messageClear" type="password" /></td>
				</tr>
			</tbody>
		</table>
		
		<div>
			<my-button image="save.png" class="right spaced"
				@trigger="set"
				:active="canSave"
				:caption="capGen.button.save"
			/>
		</div>
		
		<div class="message" v-if="messageOutput !== ''">{{ messageOutput }}</div>
	</div>`,
	data:function() {
		return {
			message:'',
			pwNew0:'',
			pwNew1:'',
			pwOld:''
		};
	},
	computed:{
		canSave:function() {
			return this.pwMatch && this.pwNew0.length !== 0 && this.pwOld.length !== 0;
		},
		pwMatch:function() {
			return this.pwNew0 === this.pwNew1;
		},
		messageOutput:function() {
			if(this.message !== '')
				return this.message;
			
			if(this.pwNew0 !== '' && !this.pwMatch)
				return this.capApp.messagePwDiff;
			
			return '';
		},
		
		// stores
		loginName:function() { return this.$store.getters.loginName; },
		capApp:   function() { return this.$store.getters.captions.settings.account; },
		capGen:   function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// actions
		messageClear:function() {
			this.message = '';
		},
		
		// backend calls
		set:function() {
			ws.send('password','set',{
				pwNew0:this.pwNew0,
				pwNew1:this.pwNew1,
				pwOld:this.pwOld
			},true).then(
				res => {
					switch(res.payload.code){
						case 'PW_CURRENT_WRONG':    this.message = this.capApp.messagePwCurrentWrong; break;
						case 'PW_REQUIRES_DIGIT':   this.message = this.capApp.messagePwRequiresDigit; break;
						case 'PW_REQUIRES_LOWER':   this.message = this.capApp.messagePwRequiresLower; break;
						case 'PW_REQUIRES_SPECIAL': this.message = this.capApp.messagePwRequiresSpecial; break;
						case 'PW_REQUIRES_UPPER':   this.message = this.capApp.messagePwRequiresUpper; break;
						case 'PW_TOO_SHORT':        this.message = this.capApp.messagePwShort; break;
					}
					this.pwNew0 = '';
					this.pwNew1 = '';
					this.pwOld  = '';
				},
				err => this.$root.genericError(err)
			);
		}
	}
};

let MySettings = {
	name:'my-settings',
	components:{
		MySettingsAccount,
		MySettingsEncryption
	},
	template:`<div class="settings">
		
		<div class="contentBox grow">
			<div class="top">
				<div class="area">
					<img class="icon" src="images/person.png" />
					<h1>{{ capApp.pageTitle }}</h1>
				</div>
				<div class="area">
					<my-button image="logoff.png"
						@trigger="$emit('logout')"
						:cancel="true"
						:caption="capApp.button.logout"
						:darkBg="true"
					/>
				</div>
			</div>
			<div class="content no-padding">
			
				<!-- display -->
				<div class="contentPart short">
					<div class="contentPartHeader">
						<img class="icon" src="images/visible1.png" />
						<h1>{{ capApp.titleDisplay }}</h1>
					</div>
					<table class="default-inputs">
						<tbody>
							<tr>
								<td>{{ capApp.languageCode }}</td>
								<td>
									<select v-model="settingsInput.languageCode">
										<option
											v-for="l in languageCodes"
											:value="l"
										>{{ l }}</option>
									</select>
								</td>
							</tr>
							<tr>
								<td>{{ capApp.dateFormat }}</td>
								<td>
									<select v-model="settingsInput.dateFormat">
										<option value="Y-m-d">{{ capApp.dateFormat0 }}</option>
										<option value="Y/m/d">{{ capApp.dateFormat1 }}</option>
										<option value="d.m.Y">{{ capApp.dateFormat2 }}</option>
										<option value="d/m/Y">{{ capApp.dateFormat3 }}</option>
										<option value="m/d/Y">{{ capApp.dateFormat4 }}</option>
									</select>
								</td>
							</tr>
							<tr>
								<td>{{ capApp.sundayFirstDow }}</td>
								<td><my-bool v-model="settingsInput.sundayFirstDow" /></td>
							</tr>
							<tr>
								<td>{{ capApp.warnUnsaved }}</td>
								<td><my-bool v-model="settingsInput.warnUnsaved" /></td>
							</tr>
						</tbody>
					</table>
				</div>
				
				<!-- theme -->
				<div class="contentPart short">
					<div class="contentPartHeader">
						<img class="icon" src="images/layout.png" />
						<h1>{{ capApp.titleTheme }}</h1>
					</div>
					<table class="default-inputs">
						<tbody>
							<tr>
								<td>{{ capApp.headerCaptions }}</td>
								<td><my-bool v-model="settingsInput.headerCaptions" /></td>
							</tr>
							<tr>
								<td>{{ capApp.bordersAll }}</td>
								<td><my-bool v-model="settingsInput.bordersAll" /></td>
							</tr>
							<tr>
								<td>{{ capApp.bordersCorners }}</td>
								<td>
									<select v-model="settingsInput.bordersCorner">
										<option value="keep"   >{{ capApp.option.cornerKeep }}</option>
										<option value="rounded">{{ capApp.option.cornerRounded }}</option>
										<option value="squared">{{ capApp.option.cornerSquared }}</option>
									</select>
								</td>
							</tr>
							<tr>
								<td>{{ capApp.fontSize }}</td>
								<td>
									<select v-model="settingsInput.fontSize">
										<option v-for="i in 11"
											:value="70 + (i*5)"
										>{{ (70 + (i*5)) + '%' }}</option>
									</select>
								</td>
							</tr>
							<tr>
								<td>{{ capApp.spacing }}</td>
								<td>
									<select v-model.number="settingsInput.spacing">
										<option :value="1">{{ capGen.option.size0 }}</option>
										<option :value="2">{{ capGen.option.size1 }}</option>
										<option :value="3">{{ capGen.option.size2 }}</option>
										<option :value="4">{{ capGen.option.size3 }}</option>
										<option :value="5">{{ capGen.option.size4 }}</option>
									</select>
								</td>
							</tr>
							<tr>
								<td>{{ capApp.dark }}</td>
								<td><my-bool v-model="settingsInput.dark" /></td>
							</tr>
							<tr>
								<td>{{ capApp.compact }}</td>
								<td><my-bool v-model="settingsInput.compact" /></td>
							</tr>
							<tr v-if="!settingsInput.compact">
								<td>{{ capApp.pageLimit }}</td>
								<td>
									<div class="settings-page-limit">
										<my-button image="remove.png"
											@trigger="settingsInput.pageLimit -= 50"
											:active="settingsInput.pageLimit > 1200"
										/>
										<div>{{ settingsInput.pageLimit + 'px' }}</div>
										<my-button image="add.png"
											@trigger="settingsInput.pageLimit += 50"
										/>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
				
				<!-- admin -->
				<div class="contentPart short" v-if="isAdmin">
					<div class="contentPartHeader">
						<img class="icon" src="images/settings.png" />
						<h1>{{ capApp.titleAdmin }}</h1>
					</div>
					<table class="default-inputs">
						<tbody>
							<tr>
								<td>{{ capApp.hintFirstSteps }}</td>
								<td><my-bool v-model="settingsInput.hintFirstSteps" /></td>
							</tr>
						</tbody>
					</table>
				</div>
				
				<!-- account -->
				<div class="contentPart short">
					<div class="contentPartHeader">
						<img class="icon" src="images/lock.png" />
						<h1>{{ capApp.titleAccount }}</h1>
					</div>
					<my-settings-account />
				</div>
				
				<!-- encryption -->
				<div class="contentPart short">
					<div class="contentPartHeader">
						<img class="icon" src="images/key.png" />
						<h1>{{ capApp.titleEncryption }}</h1>
					</div>
					<my-settings-encryption />
				</div>
			</div>
		</div>
	</div>`,
	emits:['logout'],
	data:function() {
		return {
			settingsInput:{},
			settingsLoaded:false
		};
	},
	watch:{
		settingsInput:{
			handler:function() {
				if(this.settingsLoaded)
					this.setSetting(this.settingsInput);
			},
			deep:true
		}
	},
	computed:{
		// stores
		languageCodes:function() { return this.$store.getters['schema/languageCodes']; },
		capGen:       function() { return this.$store.getters.captions.generic; },
		capApp:       function() { return this.$store.getters.captions.settings; },
		isAdmin:      function() { return this.$store.getters.isAdmin; },
		settings:     function() { return this.$store.getters.settings; }
	},
	mounted:function() {
		this.settingsInput = JSON.parse(JSON.stringify(this.settings));
		this.$store.commit('moduleColor1','');
		this.$store.commit('pageTitle',this.capApp.pageTitle);
		
		this.$nextTick(function() {
			this.settingsLoaded = true;
		});
	},
	methods:{
		// externals
		setSetting
	}
};