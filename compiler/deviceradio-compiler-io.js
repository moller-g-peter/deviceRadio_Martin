DeviceRadio.Compiler.prototype.objects['io'] = {
	// initiate
	setup: function() {		
		// define the io symbol
		this.that._s['io'] = {
			base: 'io',
			template: true
		};
		
		// max io count
		this.max_io = this.that.capabilities.max_io;
		
		// setup io handling
		this.io_conf = [];
		for (var i = 0; i < this.max_io; i++) {
			this.io_conf.push({
				trigger: null,		// the trigger for this pin
				used: false,		// monitor if in use
				reserved: false,	// true if pin is locked by another function (uart, i2c etc)
				pushpull: null,		// use pin as a push-pull, default is open collector
				highdrive: null,	// enable high drive strength, default is false
				analog: null		// configure pin as analog, default is digital
			});
		}
		
		// install as I/O manager
		this.that.io = this;
	},
	
	// reserve an i/o pin
	reserve: function(pin, opt) {
		if (pin < 0 || pin >= this.max_io) throw new Error("I/O pin number must be between 0 and " + this.max_io);
		if (this.io_conf[pin].used || this.io_conf[pin].reserved) throw new Error("Unexpected error, I/O pin " + pin + " already used");
		
		// reserve pin
		this.io_conf[pin].reserved = true;
		
		// options for pin reserve
		if (typeof opt !== "object") opt = {};
		if ('pushpull' in opt) this.io_conf[pin].pushpull = (opt.pushpull === true);
		if ('highdrive' in opt) this.io_conf[pin].highdrive = (opt.highdrive === true);
		if ('analog' in opt) this.io_conf[pin].analog = (opt.analog === true);
	},

	// template
	template: {
		props: ['pin', 'on_change', 'push_pull', 'high_drive_strength'],
		require: ['pin'],
		set: 'write',
		get: 'read',
		calls: {
			'set': {
				arg: ['c'],
				mod: [null],
				flexible: true
			},
			'clear': {
				arg: ['c'],
				mod: [null],
				flexible: true
			},
			'read': {
				arg: ['c'],
				reg: ['o'],
				mod: ["write"],
				flexible: true
			},
			'write': {
				arg: ['c'],
				reg: [0],
				mod: [],
				flexible: true
			}
		}
	},

	// analyze call
	analyze: function(sub, call, regs, args) {
		var that = this.that;

		// only validate read and write
		if (call !== 'read' && call !== 'write') return;

		// validate and log usage
		if (regs[0].type === "INTEGER") {
			if (regs[0].bits != 1) throw new DeviceRadio.Compiler.CompilerException("Value must be boolean (1 bit)", regs[0]);
		}
		else {
			if (((regs[0].bits !== null) ? regs[0].bits : that._v[regs[0].name].bits) != 1)
				throw new DeviceRadio.Compiler.CompilerException("Variable must be boolean (1 bit)", regs[0]);
			// log access
			if (call == 'write') {
				that._v[regs[0].name].read.push(sub);
				if (that._v[regs[0].name].write.indexOf(sub) < 0) that._v[regs[0].name].depend.push(sub);
			}
			else if (call == 'read') {
				that._v[regs[0].name].write.push(sub);
				// log trigger usage
				if (that._v[regs[0].name].trigger !== null) that._t[that._v[regs[0].name].trigger].source.push(sub);
			}
		}
	},

	// validate configuration properties
	validate: function(symbol) {
		var that = this.that;
		var entry = that._s[symbol];
		
		// make sure correct pin number
		that.assert(entry.conf.pin, "INTEGER", {
			max: this.max_io - 1
		});
		var pin = entry.conf.pin.value[0];
		
		// make sure the pin is available
		if (this.io_conf[pin].reserved)
			throw new DeviceRadio.Compiler.CompilerException("I/O pin " + pin + " is reserved by another function", val);
		this.io_conf[pin].used = true;
		
		// iterate properties
		for (var prop in entry.conf) {
			if (entry.conf.hasOwnProperty(prop)) {
				var val = entry.conf[prop];
				switch (prop) {
				case 'pin':
					break;
				case 'on_change':
					that.assert(val, "TRIGGER", {
						create: 'local'
					});
					if (val.ns === null) val.ns = that.namespace;
					val['name'] = val.ns + "::" + val.value;
					if (this.io_conf[pin].trigger !== null && this.io_conf[pin].trigger !== val.name)
						throw new DeviceRadio.Compiler.CompilerException("I/O pin " + pin + " already have a trigger defined", val);
					this.io_conf[pin].trigger = val.name;
					break;
				case 'push_pull':
					that.assert(val, "INTEGER", {
						bits: 1
					});
					if (this.io_conf[pin].pushpull !== null && this.io_conf[pin].pushpull !== (val.value[0] != 0))
						throw new DeviceRadio.Compiler.CompilerException("Push-pull/open-collector mode already selected for I/O pin " + pin, val);
					this.io_conf[pin].pushpull = (val.value[0] != 0);
					break;
				case 'high_drive_strength':
					that.assert(val, "INTEGER", {
						bits: 1
					});
					if (this.io_conf[pin].highdrive !== null && this.io_conf[pin].highdrive !== (val.value[0] != 0))
						throw new DeviceRadio.Compiler.CompilerException("Drive strength already selected for I/O pin " + pin, val);
					this.io_conf[pin].highdrive = (val.value[0] != 0);
					break;
				default:
					throw new DeviceRadio.Compiler.CompilerException("Unknown property '" + prop + "'", val);
					break;
				}
			}
		}
		// setup trigger
		if (this.io_conf[pin].trigger === null) this.io_conf[pin].trigger = that.createTrigger();
		entry['trigger'] = this.io_conf[pin].trigger;
		that._t[entry['trigger']].source.push(symbol);
	},
	
	// generate global configure
	generate: function() {
		var that = this.that;
		var config = that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.BOOT_CONFIG];
		
		// find config
		var trigger = -1;
		var pushpull = 0;
		var highdrive = 0;
		var analog = 0;
		for (var i = 0; i < this.max_io; i++) {
			var io = this.io_conf[i];
			if (io.trigger !== null && 'id' in that._t[io.trigger]) trigger = i;
			if (io.pushpull === true) pushpull |= 1 << i;
			if (io.highdrive === true) highdrive |= 1 << i;
			if (io.analog === true) analog |= 1 << i;
		}
		
		// analog pins
		if (analog > 0) {
			// disable push-pull and high drive strength on analog pins
			highdrive &= (analog ^ 0xff);
			pushpull &= (analog ^ 0xff);
			// add config
			config.push(0x16);
			config.push(0x01);
			config.push(analog);
		}
		
		// drive strength
		if (highdrive > 0) {
			// add config
			config.push(0x14);
			config.push(0x01);
			config.push(highdrive);
		}

		// push pull
		if (pushpull > 0) {
			// add config
			config.push(0x15);
			config.push(0x01);
			config.push(pushpull);
		}

		// add trigger config
		if (trigger >= 0) {
			config.push(0x10);
			config.push(trigger + 1);
			for (var i = 0; i <= trigger; i++) {
				if (this.io_conf[i].trigger !== null) {
					if ('id' in that._t[this.io_conf[i].trigger]) config.push(that._t[this.io_conf[i].trigger].id);
					else config.push(0xff);
				}
				else config.push(0xff);
			}
		}
	},
	
	// generate instruction
	compile: function(state, call, regs, args, opt) {
		var that = this.that;

		// fetch I/O pin
		var pin = that._s[args[0]].conf.pin.value[0];
		state.api.select(opt.swap[0]);
		if (call == "read") {
			state.api.push(0xA0 | pin);
		}
		else if (call == "write") {
			state.api.push(0xA8 | pin);
		}
		else if (call == "set") {
			state.api.push(0xF1);
			state.register++;
			state.api.select(opt.swap[0]);
			state.api.push(0xA8 | pin);
		}
		else if (call == "clear") {
			state.api.push(0xF0);
			state.register++;
			state.api.select(opt.swap[0]);
			state.api.push(0xA8 | pin);
		}
		state.register++;
	}
};