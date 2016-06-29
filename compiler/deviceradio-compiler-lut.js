DeviceRadio.Compiler.prototype.objects['lookup'] = {
	// initiate
	setup: function() {		
		// define the lookup symbol
		this.that._s['lookup'] = {
			base: 'lookup',
			template: true
		};
	},
	
	// template
	template: {
		props: ['table', 'min', 'max', 'bits_in', 'bits_out', 'saturate_above', 'saturate_below'],
		require: ['table'],
		calls: {
			'': {
				reg: ['c', 0, 'o'],
				mod: [true, true, "copy"]
			}
		}
	},

	// analyze call
	analyze: function(sub, call, regs, args) {
		var that = this.that;
		
		// input register
		if (regs[1].type === "INTEGER") {
			if (regs[1].bits > this._config.bits_in)
				throw new DeviceRadio.Compiler.CompilerException("Value is larger than " + this._config.bits_in + " bits", regs[1]);
		}
		else {
			var bits = (regs[1].bits !== null) ? regs[1].bits : that._v[regs[1].name].bits;
			if (bits !== this._config.bits_in)
				throw new DeviceRadio.Compiler.CompilerException("Variable must be " + this._config.bits_in + " bits", regs[1]);
		}

		// output register
		if (that._v[regs[2].name].bits !== this._config.bits_out)
			throw new DeviceRadio.Compiler.CompilerException("Return variable must be " + this._config.bits_out + " bits", regs[2]);
	},

	// validate configuration properties
	validate: function(symbol) {
		var that = this.that;
		var entry = that._s[symbol];

		// handle table variable first
		var table = entry.conf["table"];
		that.assert(table, "VARIABLE", {
			scope: null,
			cast: null,
			array: null
		});
		var name = ((table.ns !== null) ? table.ns : that.namespace) + "::" + table.value;
		table['name'] = name;
		var table_var = that._v[name];
		table_var.read.push(symbol);

		// default
		var bits_in = 8;
		var bits_out = 8;
		var saturate_below = true;
		var saturate_above = true;

		// iterate properties first time
		for (var prop in entry.conf) {
			if (entry.conf.hasOwnProperty(prop)) {
				var val = entry.conf[prop];
				switch (prop) {
				case 'bits_in':
					that.assert(val, "INTEGER", {
						min: 1,
						max: 128
					});
					bits_in = val.value[0];
					break;
				case 'bits_out':
					that.assert(val, "INTEGER", {
						min: 1,
						max: 128
					});
					bits_out = val.value[0];
					break;
				case 'saturate_above':
					that.assert(val, "INTEGER", {
						bits: 1
					});
					saturate_above = val.value[0] == 1;
					break;
				case 'saturate_below':
					that.assert(val, "INTEGER", {
						bits: 1
					});
					saturate_below = val.value[0] == 1;
					break;
				}
			}
		}

		// handle min level
		var max = Math.pow(2, bits_in) - 1;
		var min = 0;
		var min_max_set = false;
		if ('min' in entry.conf) {
			that.assert(entry.conf.min, "INTEGER", {
				max: max - 1
			});
			min = entry.conf.min.value[0];
			if (entry.conf.min.value.length > 1) min += entry.conf.min.value[1] * 256;
			min_max_set = true;
		}
		if ('max' in entry.conf) {
			that.assert(entry.conf.max, "INTEGER", {
				min: min + 1,
				max: max
			});
			max = entry.conf.max.value[0];
			if (entry.conf.max.value.length > 1) max += entry.conf.max.value[1] * 256;
			min_max_set = true;
		}
		
		// make sure it fits
		var count = (max - min) + 1;
		var bits;
		if (bits_out <= 4) bits = 4;
		else if (bits_out & 7) bits = ((bits_out >> 3) + 1) << 3;
		else bits = bits_out;
		var size = count * bits;
		if (size > table_var.size)
			throw new DeviceRadio.Compiler.CompilerException("The \$" + table.value + " variable must be at least " + ((size & 7) ? size + " bits" : (size >> 3) + " bytes"), table);
		
		// store parsed config values
		this._config = {
			bits_in: bits_in,
			bits_out: bits_out,
			min_max_set: min_max_set,
			min: min,
			max: max,
			saturate_below: saturate_below,
			saturate_above: saturate_above
		};
	},
	
	// generate module configuration
	generateConfig: function(sub, entry) {
		var that = this.that;
		var conf = [this._config.bits_in, this._config.bits_out, '??', '??'];
		
		// make sure table variable is a const
		var table_var = that._v[entry.conf.table.name];
		if (table_var.status !== "const")
			throw new DeviceRadio.Compiler.CompilerException("The \$" + entry.conf.table.value + " variable must be a constant. Writes are not allowed", entry.conf.table);
		
		// optional config
		if (this._config.min_max_set || !this._config.saturate_below || !this._config.saturate_above) {
			if (this._config.bits_in <= 8) {
				conf.push(this._config.min);
				conf.push(this._config.max);
			}
			else {
				conf.push(this._config.min >> 8);
				conf.push(this._config.min & 0xff);
				conf.push(this._config.max >> 8);
				conf.push(this._config.max & 0xff);
			}
			var flags = 0;
			if (!this._config.saturate_below) flags |= 0x01;
			if (!this._config.saturate_above) flags |= 0x10;
			conf.push(flags);
		}

		// add a symbol
		entry['data'] = conf;
		that._compiler.symbols.push({
			what: ['const', entry.conf.table.name],
			where: ['conf', sub, 2]
		});
	},
	
	// generate instruction
	compile: function(state, call, regs, args) {
		state.api.push(0x0A);
		state.regs[2].where = (this._config.bits_out > 16) ? "rom" : "reg";
	}
};
