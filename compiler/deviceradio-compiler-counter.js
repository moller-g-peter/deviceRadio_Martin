DeviceRadio.Compiler.prototype.objects['counter'] = {
	// initiate
	setup: function() {		
		// define the counter symbol
		this.that._s['counter'] = {
			base: 'counter',
			template: true
		};
	},
	
	// template
	template: {
		props: ['counter', 'min', 'max', 'overflow_up', 'overflow_down', 'on_overflow', 'on_count'],
		require: ['counter'],
		calls: {
			'up': {
				reg: ['c'],
				mod: []
			},
			'down': {
				reg: ['c'],
				mod: []
			},
			'updown': {
				reg: ['c', 0],
				mod: []
			}
		}
	},

	// analyze call
	analyze: function(sub, call, regs, args) {
		var that = this.that;
		var entry = that._s[regs[0]];
		
		// log trigger usage
		if ('on_overflow' in entry.conf) that._t[entry.conf.on_overflow.name].source.push(sub);
		if ('on_count' in entry.conf) that._t[entry.conf.on_count.name].source.push(sub);
	},

	// validate configuration properties
	validate: function(symbol) {
		var that = this.that;
		var entry = that._s[symbol];
		// handle counter first
		var counter = entry.conf["counter"];
		that.assert(counter, "VARIABLE", {
			scope: null,
			cast: null,
			bits: [8, 16]
		});
		// depend on the variable
		var name = ((counter.ns !== null) ? counter.ns : that.namespace) + "::" + counter.value;
		var counter_var = that._v[name];
		if ('status' in counter_var && counter_var.status !== "ram")
			throw new DeviceRadio.Compiler.CompilerException("Can't use $'" + counter.value + "' as the counter", val);
		counter['name'] = name;
		counter_var['status'] = 'ram';
		counter_var.depend.push(symbol);
		counter_var.write.push(symbol);
		// get the bit size of the counter variable
		var bits = counter_var.bits;
		// iterate properties
		for (var prop in entry.conf) {
			if (entry.conf.hasOwnProperty(prop)) {
				var val = entry.conf[prop];
				switch (prop) {
				case 'counter':
					break;
				case 'min':
					that.assert(val, "INTEGER", {
						max: (bits == 16) ? 65535 : 255
					});
					break;
				case 'max':
					that.assert(val, "INTEGER", {
						max: (bits == 16) ? 65535 : 255
					});
					break;
				case 'overflow_up':
					that.assert(val, "INTEGER", {
						bits: 1
					});
					break;
				case 'overflow_down':
					that.assert(val, "INTEGER", {
						bits: 1
					});
					break;
				case 'on_overflow':
					that.assert(val, "TRIGGER", {
						create: 'local'
					});
					if (val.ns === null) val.ns = that.namespace;
					val['name'] = val.ns + "::" + val.value;
					break;
				case 'on_count':
					that.assert(val, "TRIGGER", {
						create: 'local'
					});
					if (val.ns === null) val.ns = that.namespace;
					val['name'] = val.ns + "::" + val.value;
					entry['trigger'] = val.name;
					break;
				}
			}
		}
		// add trigger
		if (!('trigger' in entry)) {
			entry['trigger'] = that.createTrigger();
		}
	},
	
	// generate module configuration
	generateConfig: function(sub, entry) {
		var that = this.that;
		var conf = [0x00, '??', '??'];
		var counter_var = that._v[entry.conf.counter.name];
		// setup flag
		var flags = (counter_var.bits == 16) ? 0x01 : 0x00;
		if ('overflow_up' in entry.conf && entry.conf.overflow_up.value[0] != 0) flags |= 0x10;
		if ('overflow_down' in entry.conf && entry.conf.overflow_down.value[0] != 0) flags |= 0x20;
		conf[0] = flags;
		// setup extra
		var trigger = ('on_overflow' in entry.conf) ? that._t[entry.conf.on_overflow.name] : {};
		if ('id' in trigger || 'min' in entry.conf || 'max' in entry.conf) {
			conf.push(('id' in trigger) ? trigger.id : 0xff);
			if ('min' in entry.conf || 'max' in entry.conf) {
				var min = 0
				var max = 0;
				if (counter_var.bits == 16) {
					if ('min' in entry.conf) {
						min = entry.conf.min.value[0];
						if (entry.conf.min.value.length > 1) min += entry.conf.min.value[1] * 256;
					}
					if ('max' in entry.conf) {
						max = entry.conf.max.value[0];
						if (entry.conf.max.value.length > 1) max += entry.conf.max.value[1] * 256;
					}
					else max = 0xffff;
					conf.push(min >> 8);
					conf.push(min & 0xff);
					conf.push(max >> 8);
					conf.push(max & 0xff);
				}
				else {
					if ('min' in entry.conf) min = entry.conf.min.value[0];
					if ('max' in entry.conf) max = entry.conf.max.value[0];
					else max = 0xff;
					conf.push(min);
					conf.push(max);
				}
			}
		}
		// add a symbol
		entry['data'] = conf;
		that._compiler.symbols.push({
			what: ['ram', entry.conf.counter.name, entry.conf.counter.index],
			where: ['conf', sub, 1]
		});
	},
	
	// generate instruction
	compile: function(state, call, regs, args) {
		var that = this.that;
		
		switch (call) {
		case "up":
			state.api.push(0x0B);
			break;
		case "down":
			state.api.push(0x0C);
			break;
		case "updown":
			state.api.push(0x0D);
			break;
		}
		
		// handle count trigger
		var counter = that._s[regs[0]];
		if ('on_count' in counter.conf) {
			var trigger = that._t[counter.conf.on_count.name];
			var id = ('id' in trigger) ? trigger.id : 0xff;
			if (id < 0xff) {
				state.api.push(0xcc);
				state.api.push(id);
			}
		}
		state.api.cond = false;
	}
};
