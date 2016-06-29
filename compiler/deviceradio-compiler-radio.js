DeviceRadio.Compiler.prototype.objects['radio'] = {
	// initiate
	setup: function() {		
		// define the radio symbol
		this.that._s['radio'] = {
			base: 'radio',
		};
		// configuration
		this.conf = {
			// the registered radio transmission sub program
			transmit_sub: null,
			// true if radio is active
			active: false,
			// default classes
			"class": 0x3f,
			subclass: 0xff,
			// list of used variable names (to prevent duplicate variables being used as buffers)
			used: [],
			// buffers used by the configuration
			buffers: {},
			// triggers used by receiver and configuration
			triggers: {}, // filled in by optProcessOverlapping in deviceradio-compiler-optimizer
			// reserved classes
			reserved: [0x00, 0x01, 0x02]
		};
	},
	
	// template
	template: {
		props: ['transmit', 'receive', 'config', 'class', 'subclass'],
		require: [],
		calls: {
			'transmit': {
				mutex: "transmit"
			},
			'register': {
			}
		}
	},

	// analyze call
	analyze: function(sub, call, regs, args) {
		var that = this.that;
		
		// handle the master reset generator
		if (call == 'register') {
			if (this.conf.transmit_sub !== null) throw new Error("Handler for radio transmission already defined");
			this.conf.transmit_sub = sub;
		}
	},

	// validate configuration properties
	validate: function(symbol) {
		var that = this.that;
		var entry = that._s[symbol];
		
		// config
		var config = this.conf.buffers;
		
		// iterate properties
		for (var prop in entry.conf) {
			if (entry.conf.hasOwnProperty(prop)) {
				var val = entry.conf[prop];
				switch (prop) {
				case 'transmit':
				case 'receive':
				case 'config':
					if (prop in config) throw new DeviceRadio.Compiler.CompilerException("Property '" + prop + "' already defined", val);
					that.assert(val, "VARIABLE", {
						scope: null,
						cast: null,
						array: null,
						nested: false,
						max_size: 256
					});
					var name = ((val.ns !== null) ? val.ns : that.namespace) + "::" + val.value;
					
					// make sure it hasn't been used
					if (this.conf.used.indexOf(name) > -1)
						 throw new DeviceRadio.Compiler.CompilerException("Variable '" + val.value + "' already used as a radio buffer", val);
					this.conf.used.push(name);
					
					var variable = that._v[name];
					if ('status' in variable && variable.status !== "ram")
						throw new DeviceRadio.Compiler.CompilerException("Can't use $'" + val.value + "' as a radio buffer", val);
					if (!('name' in val)) val['name'] = name;
					variable['align'] = true;
					config[prop] = name;
					
					// create write trigger
					if (prop == "transmit") {
						if (this.conf.transmit_sub === null)
							throw new DeviceRadio.Compiler.CompilerException("Radio transmitter handler not found", val);

						if (that._v[val.name].trigger === null) that._v[val.name].trigger = that.createTrigger();						
						that._t[that._v[val.name].trigger].target.push(this.conf.transmit_sub);

						variable.depend.push(symbol);
						variable.read.push(symbol);
					}
					else {
						variable.write.push(symbol);
					}
					
					break;
				case 'class':
					that.assert(val, "INTEGER", {
						max_bits: 6
					});
					var class_id = val.value[0];
					if (this.conf.reserved.indexOf(class_id) > -1)
						throw new DeviceRadio.Compiler.CompilerException("Device class 0x" + (class_id >> 4).toString(16) + (class_id & 15).toString(16) + " is reserved for system use", val);
					this.conf['class'] = class_id;
					break;
				case 'subclass':
					that.assert(val, "INTEGER", {
						max_bits: 8
					});
					this.conf['subclass'] = val.value[0];
					break;
				default:
					throw new DeviceRadio.Compiler.CompilerException("Unknown property '" + prop + "'", val);
					break;
				}
			}
		}
		this.conf.buffers = config;
	},

	// generate global configure
	generate: function() {
		var that = this.that;
		var config = that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.BOOT_CONFIG];
		
		// true if radio is active
		var active = this.conf.active;
		
		// transmitter config
		if ('transmit' in this.conf.buffers) {
			var tx = that._v[this.conf.buffers.transmit];
			if (tx['status'] == "ram") {
				var bytes = (tx.size & 0x07) ? (tx.size >> 3) + 1 : tx.size >> 3;

				// header
				config.push(0x0d);
				config.push(3);
				
				// add address
				that._compiler.symbols.push({
					what: ['ram', this.conf.buffers.transmit, null],
					where: ['bconf', true, config.length]
				});
				config.push('??');
				config.push('??');
				config.push(bytes);
				
				active = true;
			}
		}
		
		// receiver config
		var _this = this;
		var addReceiveConfig = function (type) {
			if (type in _this.conf.buffers && type in _this.conf.triggers) {
				var rx = that._v[_this.conf.buffers[type]];
				if (rx['status'] == "ram") {
					var bytes = (rx.size & 0x07) ? (rx.size >> 3) + 1 : rx.size >> 3;

					// header
					config.push((type == "receive") ? 0x0e : 0x0f);
					config.push(bytes + 3);
					
					// add address
					that._compiler.symbols.push({
						what: ['ram', _this.conf.buffers[type], null],
						where: ['bconf', true, config.length]
					});
					config.push('??');
					config.push('??');
					config.push(bytes);
					
					// add triggers
					for (var i = 0; i < bytes; i++) {
						var trigger = that._t[_this.conf.triggers[type][i]];
						config.push(('id' in trigger) ? trigger.id : 0xff);
					}
					
					active = true;
				}
			}
		};
		addReceiveConfig("receive");

		// configuration config
		addReceiveConfig("config");
		
		// core radio config
		if (active) {
					
			// header
			config.push(0x0c);
			config.push(3);
			
			// device class
			config.push(this.conf['class']);
			config.push(this.conf['subclass']);
			
			// mutex (not resolved yet so use a symbol)
			that._compiler.symbols.push({
				what: ['mutex', 'transmit'],
				where: ['bconf', null, config.length]
			});
			config.push(0xff);
		}
	},

	// generate instruction
	compile: function(state, call, regs, args) {
		var that = this.that;
		
		if (call == "transmit") {
			if ('transmit' in this.conf.buffers) {
				var tx = that._v[this.conf.buffers.transmit];
				if (tx['status'] == "ram") state.api.push(0x45);
			}
		}
	}
};