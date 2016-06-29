DeviceRadio.Compiler.prototype.objects['boot'] = {
	// initiate
	setup: function() {		
		// the shared reset trigger
		this.trigger = this.that.createTrigger();
		
		// define the reset symbol
		this.that._s['boot'] = {
			base: 'boot',
			trigger: this.trigger
		};
	},

	// template
	template: {
		calls: {
			'': {
				mod: []
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
			if (that.reset !== null) throw new Error("Default system reset handler already defined");
			that.reset = that.createTrigger();
			that._t[that.reset].source.push("boot");
			that._t[that.reset].target.push(sub);
		}
	},
	
	// generate instruction
	compile: function(state, call, regs, args, opt) {
		var that = this.that;
		
		if (call === "register") {
			// find what to load
			var load = [];
			for (var key in that._v) {
				if (!that._v.hasOwnProperty(key)) continue;
				var v = that._v[key];
				// load default value
				if (v.status !== "const" && 'const' in v && v['const'] !== null) {
					// get a consistent name to sort by
					var o = that._c[v['const']];
					var sort = o.address.toString(16);
					while (sort.length < 4) sort = '0' + sort;
					// real bit size
					var bits = o.bits;
					if (o.array > 1) {
						if (bits > that.capabilities.max_arg_bits && (bits & 7)) {
							bits = ((bits >> 3) + 1) << 3;
						}
						bits *= o.array;
					}
					// add to list
					load.push({
						name: key,
						'const': v['const'],
						bits: bits,
						sort: sort + "." + bits
					});
				}
			}
			// sort the list
			load.sort(function (a, b) {
				return a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0;
			});
			// generate code
			var loaded = null;
			for (var i = 0; i < load.length; i++) {
				// special handling of very large constants
				if (load[i].bits > that.capabilities.max_bits) {
					var bits_left = load[i].bits;
					var offset = 0;
					while (bits_left) {
						var bits = (bits_left > that.capabilities.max_bits) ? that.capabilities.max_bits : bits_left;
						// source
						loaded = load[i].load;
						state.api.select(0);
						state.api.push(0xC6);
						state.api.push(state.api.romAddress(load[i]['const'], offset));
						state.api.push(bits);
						state.register++;
						// destination
						state.api.select(0);
						state.api.push(0xC9);
						state.api.push(state.api.ramAddress(load[i].name, null, offset));
						state.register++;
						// next block
						bits_left -= bits;
						offset += bits;
					}
					loaded = null;
				}
				else {
					// source
					if (loaded !== load[i].load) {
						loaded = load[i].load;
						state.api.select(0);
						state.api.push(0xC6);
						state.api.push(state.api.romAddress(load[i]['const']));
						state.api.push(load[i].bits);
						state.register++;
					}
					// destination
					state.api.select(0);
					state.api.push(0xC9);
					state.api.push(state.api.ramAddress(load[i].name));
					state.register++;
				}
			}
			// restore register pointer
			if (load.length > 0) state.api.cond = false;
			
			// loop all objects to compile their reset code
			for (var prop in that.objects) {
				if (!that.objects.hasOwnProperty(prop)) continue;
				var object = that.objects[prop];
				if ('compileReset' in object) {
					object.compileReset(state);
					state.api.cond = false;
				}
			}
		}
	}
};