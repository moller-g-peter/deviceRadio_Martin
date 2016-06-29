DeviceRadio.Compiler.prototype.objects['timer'] = {
	// initiate
	setup: function() {		
		// define the timer symbol
		this.that._s['timer'] = {
			base: 'timer',
			template: true
		};
		
		// table to hold all timers
		this.timers = [];
	},

	// template
	template: {
		props: ['duration', 'start', 'restart', 'on_expire'],
		require: [],
		calls: {
			'cancel': {
				arg: ['c'],
				mod: []
			},
			'start': {
				arg: ['c'],
				mod: []
			},
			'set': {
				reg: [0],
				arg: ['c'],
				mod: []
			}
		}
	},

	// analyze call
	analyze: function(sub, call, regs, args) {
		var that = this.that;
		var entry = that._s[args[0]];
		
		if (call == 'set') {
			if (regs[0].type === "INTEGER") {
				if (regs[0].bits > 32) throw new DeviceRadio.Compiler.CompilerException("Value is larger than 32 bits", regs[0]);
				regs[0].bits = 32;
			}
			else {
				if (((regs[0].bits !== null) ? regs[0].bits : that._v[regs[0].name].bits) != 32)
					throw new DeviceRadio.Compiler.CompilerException("Variable must be 32 bits", regs[0]);
				// log access
				that._v[regs[0].name].read.push(sub);
				if (that._v[regs[0].name].write.indexOf(sub) < 0) that._v[regs[0].name].depend.push(sub);
			}
		}
	},

	// validate configuration properties
	validate: function(symbol) {
		var that = this.that;
		var entry = that._s[symbol];
		// iterate properties
		for (var prop in entry.conf) {
			if (entry.conf.hasOwnProperty(prop)) {
				var val = entry.conf[prop];
				switch (prop) {
				case 'duration':
					that.assert(val, "INTEGER", {
						max_bits: 32
					});
					val['const'] = that.createConst(32, val.value);
					break;
				case 'start':
					that.assert(val, "INTEGER", {
						bits: 1
					});
					break;
				case 'restart':
					that.assert(val, "INTEGER", {
						bits: 1
					});
					break;
				case 'on_expire':
					that.assert(val, "TRIGGER", {
						create: 'local'
					});
					entry['trigger'] = ((val.ns !== null) ? val.ns : that.namespace) + "::" + val.value;
					break;
				default:
					throw new DeviceRadio.Compiler.CompilerException("Unknown property '" + prop + "'", val);
					break;
				}
			}
		}
		// add trigger
		if (!('trigger' in entry)) {
			entry['trigger'] = that.createTrigger();
		}
		that._t[entry['trigger']].source.push(symbol);
		
		// remember timer
		entry['id'] = this.timers.length;
		this.timers.push(symbol);
		if (this.timers.length > that.capabilities.max_timers)
			throw new DeviceRadio.Compiler.CompilerException("More than the maximimum of " + that.capabilities.max_timers + " timers created");
	},
	
	// compile the reset code
	compileReset: function(state) {
		var that = this.that;

		// loop all timers
		var last = null;
		var zero = null;
		for (var i = 0; i < this.timers.length; i++) {
			var timer = that._s[this.timers[i]];
			var id = timer.id;
			var duration = ('duration' in timer.conf) ? timer.conf.duration['const'] : null;
			var start = ('start' in timer.conf) ? timer.conf.start.value[0] !== 0 : false;
			var restart = ('restart' in timer.conf) ? timer.conf.restart.value[0] !== 0 : false;
			
			// setup the timer
			if (duration !== null || start) {
				// create a zero-value if missing
				if (duration === null) {
					if (zero === null) zero = that.createConst(32);
					duration = zero;
				}
				// load value
				if (duration !== last) {
					last = duration;
					state.api.select(0);
					state.api.push(0xC6);
					state.api.push(state.api.romAddress(duration));
					state.api.push(32);
					state.register++;
				}
				// set timer
				var opc = 0x14;
				if (start) opc |= 0x01;
				if (restart) opc |= 0x08;
				state.api.push(0xDD);
				state.api.push(opc);
				state.api.push(id & 0xff);
			}
		}
	},
	
	// generate module configuration
	generateConfig: function(sub) {
	},
	
	// generate global configure
	generate: function() {
		var that = this.that;
		
		if (this.timers.length > 0) {
			var config = that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.TIMERS];
			for (var i = 0; i < this.timers.length; i++) {
				var trigger = that._t[that._s[this.timers[i]].trigger];
				config.push(('id' in trigger) ? trigger.id : 0xff);
			}
		}
	},
	
	// generate instruction
	compile: function(state, call, regs, args) {
		var that = this.that;

		// get configuration
		var timer = that._s[args[0]];
		var id = timer.id;
		
		if (call === "set") {
			var restart = ('restart' in timer.conf) ? timer.conf.restart.value[0] !== 0 : false;
			var opc = 0x14;
			if (restart) opc |= 0x08;
			state.api.select(0);
			state.api.push(0xDD);
			state.api.push(opc);
			state.api.push(id & 0xff);
		}
		else if (call === "start") {
			state.api.push(0xDD);
			state.api.push(0x11);
			state.api.push(id & 0xff);
		}
		else if (call === "cancel") {
			state.api.push(0xDD);
			state.api.push(0x12);
			state.api.push(id & 0xff);
		}
	},
	
	// create a new interval timer
	createIntervalTimer: function(val) {
		var that = this.that;
		
		// make sure the range is ok and create a const
		that.assert(val, "INTEGER", {
			max_bits: 32
		});
		val['const'] = that.createConst(32, val.value);
		
		// fake a timer
		var entry = {
			"base": "timer",
			"conf": {
				"duration": val,
				"start": {
					"row": val.row,
					"col": val.col,
					"type": "INTEGER",
					"value": [1],
					"bits": 1
				},
				"restart": {
					"row": val.row,
					"col": val.col,
					"type": "INTEGER",
					"value": [1],
					"bits": 1
				}
			}
		};
		
		// make it into a symbol
		var symbol = DeviceRadio.util.uuid();
		that._s[symbol] = entry;

		// add trigger
		entry['trigger'] = that.createTrigger();
		that._t[entry['trigger']].source.push(symbol);

		// remember timer
		entry['id'] = this.timers.length;
		this.timers.push(symbol);
		if (this.timers.length > that.capabilities.max_timers)
			throw new DeviceRadio.Compiler.CompilerException("More than the maximimum of " + that.capabilities.max_timers + " timers created", val);
			
		// return the new trigger
		return entry.trigger;
	}
};