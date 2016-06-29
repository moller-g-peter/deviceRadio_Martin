DeviceRadio.Compiler.prototype.objects['copy'] = {
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

		// size of output
		var bits = that._v[regs[1].name].bits;

		// validate and log usage
		if (regs[0].type === "INTEGER") {
			if (regs[0].bits > bits) throw new DeviceRadio.Compiler.CompilerException("Value does not fit in output variable", regs[0]);
			regs[0].bits = bits;
		}
		else {
			if (((regs[0].bits !== null) ? regs[0].bits : that._v[regs[0].name].bits) != bits)
				throw new DeviceRadio.Compiler.CompilerException("Variable is not the same size as the output variable", regs[0]);
			// log access
			that._v[regs[0].name].read.push(sub);
			if (that._v[regs[0].name].write.indexOf(sub) < 0) that._v[regs[0].name].depend.push(sub);
		}
		that._v[regs[1].name].write.push(sub);

		// log trigger usage
		if (that._v[regs[1].name].trigger !== null) that._t[that._v[regs[1].name].trigger].source.push(sub);
	},
	
	// generate instruction
	compile: function(state, call, regs, args, opt) {
		if (opt.swap[0] != opt.swap[1]) {
			state.api.copy(opt.swap[1], opt.swap[0]);
		}
		else if (state.regs[opt.swap[0]].where == "ram") {
			if (state.api.name(regs[0]) !== state.api.name(regs[1])) state.regs[opt.swap[0]].where = "rom";
		}
	}
};
