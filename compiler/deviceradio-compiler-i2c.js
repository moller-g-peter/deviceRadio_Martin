DeviceRadio.Compiler.prototype.objects['i2c'] = {
	// initiate
	setup: function() {		
		// define the lookup symbol
		this.that._s['i2c'] = {
			base: 'i2c',
			template: true
		};
		
		// conf
		this.i2c_conf = {
			enable: false
		};
	},
	
	// template
	template: {
		props: ['address', 'on_error', 'slave'],
		require: ['address'],
		set: 'write',
		get: 'read',
		calls: {
			'write': {
				reg: ['c', 0],
				mod: [],
				alt: '_write2'
			},
			'_write2': {
				reg: ['c', 1, 0],
				mod: []
			},
			'read': {
				reg: ['c', 'o'],
				mod: [true, "write"],
				alt: '_read2'
			},
			'_read2': {
				reg: ['c', 'o', 0],
				mod: [true, "write", true]
			}
		}
	},

	// analyze call
	analyze: function(sub, call, regs, args) {
		var that = this.that;
		if (call == "write" || call == "_write2") {
			// input register
			if (regs[1].type === "INTEGER") {
				// 8-bit align
				that.alignToken(regs[1]);
			}
			// cast bit size if needed
			else if (regs[1].bits === null) {
				// 8-bit align
				that.alignToken(regs[1]);
				that.logVariableR(sub, regs[1].name);
			}
			// make sure casted bit size if 8-bit aligned
			else {
				if (regs[1].bits & 7)
					throw new DeviceRadio.Compiler.CompilerException("Variable size must be byte aligned", regs[1]);
				that.logVariableR(sub, regs[1].name);
			}
			
			// offset
			if (call == "_write2") {
				// address offset register
				if (regs[2].type === "INTEGER") {
					// 8-bit align
					that.alignToken(regs[2]);
					if (regs[2].bits !== 8 && regs[2].bits !== 16)
						throw new DeviceRadio.Compiler.CompilerException("Offset value must be 8 or 16 bits", regs[2]);
				}
				// cast bit size if needed
				else {
					// 8-bit align
					var bits = that.alignToken(regs[2]);
					if (bits !== 8 && bits !== 16)
						throw new DeviceRadio.Compiler.CompilerException("Offset size must be 8 or 16 bits", regs[2]);
					that.logVariableR(sub, regs[2].name);
				}
			}
		}
		else if (call == "read" || call == "_read2") {
			// output register
			var bits = (regs[1].bits !== null) ? regs[1].bits : that._v[regs[1].name].bits;
			if (bits & 7)
				throw new DeviceRadio.Compiler.CompilerException("Variable size must be byte aligned", regs[1]);
			that.logVariableW(sub, regs[1].name);

			// offset
			if (call == "_read2") {
				// address offset register
				if (regs[2].type === "INTEGER") {
					// 8-bit align
					that.alignToken(regs[2]);
					if (regs[2].bits !== 8 && regs[2].bits !== 16)
						throw new DeviceRadio.Compiler.CompilerException("Offset value must be 8 or 16 bits", regs[2]);
				}
				// cast bit size if needed
				else {
					// 8-bit align
					var bits = that.alignToken(regs[2]);
					if (bits !== 8 && bits !== 16)
						throw new DeviceRadio.Compiler.CompilerException("Offset size must be 8 or 16 bits", regs[2]);
					that.logVariableR(sub, regs[2].name);
				}
			}
		}
	},

	// validate configuration properties
	validate: function(symbol) {
		var that = this.that;
		var entry = that._s[symbol];

		// iterate properties first time
		for (var prop in entry.conf) {
			if (entry.conf.hasOwnProperty(prop)) {
				var val = entry.conf[prop];
				switch (prop) {
				// 7-bit I2C address
				case 'address':
					that.assert(val, "INTEGER", {
						max_bits: 7
					});
					break;
				// enable slave mode
				case 'slave':
					that.assert(val, "INTEGER", {
						bits: 1
					});
					break;
				// trigger to set if bus error
				case 'on_error':
					that.assert(val, "TRIGGER", {
						create: 'local'
					});
					if (val.ns === null) val.ns = that.namespace;
					val['name'] = val.ns + "::" + val.value;
					that._t[val['name']].source.push(symbol);
					break;
				}
			}
		}
		
		// enable i2c
		if (!this.i2c_conf.enable) {
			// reserve pins
			try {
				if ('io' in that.objects) that.objects.io.reserve(0);
			}
			catch (e) {
				throw new DeviceRadio.Compiler.CompilerException("I/O pin 0 required for I2C SDA");
			}
			try {
				if ('io' in that.objects) that.objects.io.reserve(1);
			}
			catch (e) {
				throw new DeviceRadio.Compiler.CompilerException("I/O pin 1 required for I2C SCL");
			}
			// set flags
			this.i2c_conf.enable = true;
		}
	},

	// generate global configure
	generate: function() {
		var that = this.that;
		var config = that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.BOOT_CONFIG];
		
		// global i2c enable
		if (this.i2c_conf.enable) {
			config.push(0x11);
			config.push(0x00);
		}
	},

	// generate module configuration
	generateConfig: function(sub, entry) {		
		var conf = [entry.conf.address.value[0]];
		
		// option flags
		
		// add trigger
		var trigger = ('on_error' in entry.conf) ? that._t[entry.conf.on_error.name] : {};
		if ('id' in trigger) {
			if (conf.length < 2) conf.push(0x00);
			conf.push(trigger.id);
		}
		
		entry['data'] = conf;
	},
	
	// generate instruction
	compile: function(state, call, regs, args) {
		if (call == "write") state.api.push(0x41);
		else if (call == "_write2") state.api.push(0x42);
		else if (call == "read") state.api.push(0x43);
		else if (call == "_read2") state.api.push(0x44);
	}
};
