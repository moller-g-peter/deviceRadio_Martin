DeviceRadio.Compiler.prototype.objects['bool'] = {
	// template
	template: {
		calls: {
			'': {
				reg: [0, 'o'],
				mod: [true, "copy"],
				flexible: true
			}
		}
	},

	// analyze call
	analyze: function(sub, call, regs, args) {
		var that = this.that;
		
		// validate and log usage
		if (regs[0].type === "VARIABLE") {
			// log access
			that._v[regs[0].name].read.push(sub);
			if (that._v[regs[0].name].write.indexOf(sub) < 0) that._v[regs[0].name].depend.push(sub);
		}
		if (((regs[1].bits !== null) ? regs[1].bits : that._v[regs[1].name].bits) != 1)
			throw new DeviceRadio.Compiler.CompilerException("Output variable must be boolean (1-bit)", regs[1]);
		that._v[regs[1].name].write.push(sub);

		// log trigger usage
		if (that._v[regs[1].name].trigger !== null) that._t[that._v[regs[1].name].trigger].source.push(sub);
	},
	
	// generate instruction
	compile: function(state, call, regs, args, opt) {
		if (opt.swap[0] != opt.swap[1]) {
			state.api.copy(opt.swap[1], opt.swap[0]);
		}
		state.api.push(0x90 | opt.swap[1]);
		state.regs[opt.swap[1]].where = "reg";
	}
};