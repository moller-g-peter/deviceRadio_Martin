DeviceRadio.Compiler.prototype.objects['edge'] = {
	// initiate
	setup: function() {		
		// define the io symbol
		this.that._s['edge'] = {
			base: 'edge',
			template: true
		};
	},

	// template
	template: {
		props: ['on_detect', 'edge'],
		calls: {
			'': {
				arg: ['c'],
				reg: [0],
				mod: [],
				flexible: true
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
				case 'edge':
					that.assert(val, "SYMBOL", {
						values: ["raising", "falling", "both"]
					});
					break;
				case 'on_detect':
					that.assert(val, "TRIGGER", {
						create: 'local'
					});
					entry['trigger'] = ((val.ns !== null) ? val.ns : that.namespace) + "::" + val.value;
					if ('edge' in that._t[entry['trigger']] && that._t[entry['trigger']].edge)
						throw new DeviceRadio.Compiler.CompilerException("Trigger already have an edge detect associated", val);
					break;
				}
			}
		}
		// add trigger
		if (!('trigger' in entry)) {
			entry['trigger'] = that.createTrigger();
		}
		that._t[entry['trigger']].source.push(symbol);
		that._t[entry['trigger']]['edge'] = true;
	},
	
	// generate instruction
	compile: function(state, call, regs, args, opt) {
		var that = this.that;
		var flank = 2; // falling by default
		
		// get object
		var o = that._s[args[0]];
		
		// get trigger
		var trigger = that._t[o.trigger];
		var id = ('id' in trigger) ? trigger.id : 0xff;
		if (id >= 0xff) return;
		
		// resolve edge to use
		var conf = o.conf;
		if ('edge' in conf) {
			switch (conf.edge.value.toLowerCase()) {
			case "raising":
				flank = 1;
				break;
			case "both":
				flank = 3;
				break;
			}
		}
		
		// generate code
		state.api.select(opt.swap[0]);
		state.api.push(0xDD);
		state.api.push(0x00 | flank);
		state.api.push(id);
	}
};
